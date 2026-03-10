import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { verifyToken } from './utils/auth.js';
import authRoutes from './routes/auth.js';
import linksRoutes from './routes/links.js';
import analyticsRoutes from './routes/analytics.js';
import redirectRoutes from './routes/redirect.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
    '*',
    cors({
        origin: ['http://localhost:5173', 'http://localhost:3000', 'http://mphstar.my.id', 'https://mphstar.my.id'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowHeaders: ['Content-Type', 'Authorization'],
    })
);

// Auth middleware — skip for public routes
app.use('/api/links/*', async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    const payload = await verifyToken(token);
    if (!payload) return c.json({ error: 'Invalid or expired token' }, 401);
    c.set('userId' as never, payload.userId as never);
    await next();
});

app.use('/api/analytics/*', async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    const payload = await verifyToken(token);
    if (!payload) return c.json({ error: 'Invalid or expired token' }, 401);
    c.set('userId' as never, payload.userId as never);
    await next();
});

// Auth check for /me
app.use('/api/auth/me', async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    const payload = await verifyToken(token);
    if (!payload) return c.json({ error: 'Invalid or expired token' }, 401);
    c.set('userId' as never, payload.userId as never);
    await next();
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/links', linksRoutes);
app.route('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { db } from './db/index.js';
import { links, clicks } from './db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { parseUserAgent } from './utils/shortcode.js';

// API redirect handler for frontend
app.get('/api/redirect/:code', async (c) => {
    const code = c.req.param('code');

    const link = await db
        .select()
        .from(links)
        .where(eq(links.shortCode, code))
        .limit(1);

    if (link.length === 0) {
        return c.json({ error: 'Short link not found' }, 404);
    }

    if (!link[0].isActive) {
        return c.json({ error: 'This link has been deactivated' }, 410);
    }

    const userAgent = c.req.header('user-agent') || null;
    const { browser, os, device } = parseUserAgent(userAgent);
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    // Allow frontend to pass referer via header
    const referer = c.req.header('x-redirect-referer') || c.req.header('referer') || c.req.header('origin') || null;

    await Promise.all([
        db.insert(clicks).values({
            linkId: link[0].id,
            ip,
            userAgent,
            referer,
            browser,
            os,
            device,
        }),
        db
            .update(links)
            .set({ clicks: sql`${links.clicks} + 1` })
            .where(eq(links.id, link[0].id)),
    ]);

    return c.json({ url: link[0].originalUrl });
});

// Redirect handler — directly at /:code (must be LAST, after all /api routes)
app.route('/', redirectRoutes);

const port = 3001;
console.log(`🚀 Shortlink API server running at http://localhost:${port}`);

serve({
    fetch: app.fetch,
    port,
});
