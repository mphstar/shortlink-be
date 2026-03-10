import { Hono } from 'hono';
import { db } from '../db/index.js';
import { links } from '../db/schema.js';
import { eq, like, desc, sql, and } from 'drizzle-orm';
import { generateShortCode } from '../utils/shortcode.js';

const app = new Hono();

// List all links with pagination & search (user-scoped)
app.get('/', async (c) => {
    const userId = c.get('userId' as never) as number;
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const search = c.req.query('search') || '';
    const offset = (page - 1) * limit;

    const baseCondition = eq(links.userId, userId);
    const conditions = search
        ? and(baseCondition, like(links.originalUrl, `%${search}%`))
        : baseCondition;

    const [data, countResult] = await Promise.all([
        db
            .select()
            .from(links)
            .where(conditions)
            .orderBy(desc(links.createdAt))
            .limit(limit)
            .offset(offset),
        db
            .select({ count: sql<number>`count(*)` })
            .from(links)
            .where(conditions),
    ]);

    return c.json({
        data,
        pagination: {
            page,
            limit,
            total: countResult[0].count,
            totalPages: Math.ceil(countResult[0].count / limit),
        },
    });
});

// Get single link (user-scoped)
app.get('/:id', async (c) => {
    const userId = c.get('userId' as never) as number;
    const id = parseInt(c.req.param('id'));
    const link = await db.select().from(links)
        .where(and(eq(links.id, id), eq(links.userId, userId)))
        .limit(1);

    if (link.length === 0) {
        return c.json({ error: 'Link not found' }, 404);
    }

    return c.json(link[0]);
});

// Create new link (user-scoped)
app.post('/', async (c) => {
    const userId = c.get('userId' as never) as number;
    const body = await c.req.json();
    const { originalUrl, title, customCode } = body;

    if (!originalUrl) {
        return c.json({ error: 'originalUrl is required' }, 400);
    }

    const shortCode = customCode || generateShortCode();

    // Check if custom code already exists
    if (customCode) {
        const existing = await db
            .select()
            .from(links)
            .where(eq(links.shortCode, customCode))
            .limit(1);
        if (existing.length > 0) {
            return c.json({ error: 'Custom code already exists' }, 409);
        }
    }

    const result = await db
        .insert(links)
        .values({
            userId,
            shortCode,
            originalUrl,
            title: title || null,
        })
        .returning();

    return c.json(result[0], 201);
});

// Update link (user-scoped)
app.put('/:id', async (c) => {
    const userId = c.get('userId' as never) as number;
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { originalUrl, title, isActive } = body;

    const result = await db
        .update(links)
        .set({
            ...(originalUrl !== undefined && { originalUrl }),
            ...(title !== undefined && { title }),
            ...(isActive !== undefined && { isActive }),
            updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        })
        .where(and(eq(links.id, id), eq(links.userId, userId)))
        .returning();

    if (result.length === 0) {
        return c.json({ error: 'Link not found' }, 404);
    }

    return c.json(result[0]);
});

// Delete link (user-scoped)
app.delete('/:id', async (c) => {
    const userId = c.get('userId' as never) as number;
    const id = parseInt(c.req.param('id'));

    const result = await db.delete(links)
        .where(and(eq(links.id, id), eq(links.userId, userId)))
        .returning();

    if (result.length === 0) {
        return c.json({ error: 'Link not found' }, 404);
    }

    return c.json({ message: 'Link deleted successfully' });
});

export default app;
