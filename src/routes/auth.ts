import { Hono } from 'hono';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, createToken } from '../utils/auth.js';

const app = new Hono();

// Register
app.post('/register', async (c) => {
    const { name, email, password } = await c.req.json();

    if (!name || !email || !password) {
        return c.json({ error: 'Name, email and password are required' }, 400);
    }

    if (password.length < 6) {
        return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Check if email exists
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
        return c.json({ error: 'Email already registered' }, 409);
    }

    const hashed = await hashPassword(password);
    const result = await db.insert(users).values({
        name,
        email,
        password: hashed,
    }).returning();

    const user = result[0];
    const token = await createToken({ userId: user.id, email: user.email });

    return c.json({
        token,
        user: { id: user.id, name: user.name, email: user.email },
    }, 201);
});

// Login
app.post('/login', async (c) => {
    const { email, password } = await c.req.json();

    if (!email || !password) {
        return c.json({ error: 'Email and password are required' }, 400);
    }

    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (result.length === 0) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    const user = result[0];
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    const token = await createToken({ userId: user.id, email: user.email });

    return c.json({
        token,
        user: { id: user.id, name: user.name, email: user.email },
    });
});

// Get current user
app.get('/me', async (c) => {
    const userId = c.get('userId' as never) as number | undefined;
    if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (result.length === 0) {
        return c.json({ error: 'User not found' }, 404);
    }

    const user = result[0];
    return c.json({ id: user.id, name: user.name, email: user.email });
});

export default app;
