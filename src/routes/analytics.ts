import { Hono } from 'hono';
import { db } from '../db/index.js';
import { links, clicks } from '../db/schema.js';
import { eq, sql, desc, and, gte } from 'drizzle-orm';

const app = new Hono();

// Dashboard overview stats (user-scoped)
app.get('/overview', async (c) => {
    const userId = c.get('userId' as never) as number;
    const today = new Date().toISOString().split('T')[0];

    const [totalLinks] = await db
        .select({ count: sql<number>`count(*)` })
        .from(links)
        .where(eq(links.userId, userId));

    const [totalClicks] = await db
        .select({ count: sql<number>`count(*)` })
        .from(clicks)
        .innerJoin(links, eq(clicks.linkId, links.id))
        .where(eq(links.userId, userId));

    const [todayClicks] = await db
        .select({ count: sql<number>`count(*)` })
        .from(clicks)
        .innerJoin(links, eq(clicks.linkId, links.id))
        .where(and(eq(links.userId, userId), gte(clicks.createdAt, today)));

    const [activeLinks] = await db
        .select({ count: sql<number>`count(*)` })
        .from(links)
        .where(and(eq(links.userId, userId), eq(links.isActive, true)));

    return c.json({
        totalLinks: totalLinks.count,
        totalClicks: totalClicks.count,
        todayClicks: todayClicks.count,
        activeLinks: activeLinks.count,
    });
});

// Clicks over time (user-scoped)
app.get('/clicks-over-time', async (c) => {
    const userId = c.get('userId' as never) as number;
    const days = parseInt(c.req.query('days') || '30');
    const linkId = c.req.query('linkId');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    let conditions;
    if (linkId) {
        conditions = and(
            gte(clicks.createdAt, startDateStr),
            eq(clicks.linkId, parseInt(linkId)),
            eq(links.userId, userId)
        );
    } else {
        conditions = and(
            gte(clicks.createdAt, startDateStr),
            eq(links.userId, userId)
        );
    }

    const data = await db
        .select({
            date: sql<string>`date(${clicks.createdAt})`,
            count: sql<number>`count(*)`,
        })
        .from(clicks)
        .innerJoin(links, eq(clicks.linkId, links.id))
        .where(conditions)
        .groupBy(sql`date(${clicks.createdAt})`)
        .orderBy(sql`date(${clicks.createdAt})`);

    // Fill in missing days with 0
    const result: { date: string; count: number }[] = [];
    const current = new Date(startDateStr);
    const end = new Date();
    const dataMap = new Map(data.map((d) => [d.date, d.count]));

    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        result.push({ date: dateStr, count: dataMap.get(dateStr) || 0 });
        current.setDate(current.getDate() + 1);
    }

    return c.json(result);
});

// Browser/OS/Device breakdown for a link (user-scoped)
app.get('/breakdown/:linkId', async (c) => {
    const userId = c.get('userId' as never) as number;
    const linkId = parseInt(c.req.param('linkId'));

    // Verify link ownership
    const link = await db.select().from(links)
        .where(and(eq(links.id, linkId), eq(links.userId, userId)))
        .limit(1);
    if (link.length === 0) {
        return c.json({ error: 'Link not found' }, 404);
    }

    const [browsers, oses, devices] = await Promise.all([
        db
            .select({ name: clicks.browser, count: sql<number>`count(*)` })
            .from(clicks)
            .where(eq(clicks.linkId, linkId))
            .groupBy(clicks.browser),
        db
            .select({ name: clicks.os, count: sql<number>`count(*)` })
            .from(clicks)
            .where(eq(clicks.linkId, linkId))
            .groupBy(clicks.os),
        db
            .select({ name: clicks.device, count: sql<number>`count(*)` })
            .from(clicks)
            .where(eq(clicks.linkId, linkId))
            .groupBy(clicks.device),
    ]);

    return c.json({ browsers, oses, devices });
});

// Top performing links (user-scoped)
app.get('/top-links', async (c) => {
    const userId = c.get('userId' as never) as number;
    const limit = parseInt(c.req.query('limit') || '5');

    const data = await db
        .select()
        .from(links)
        .where(eq(links.userId, userId))
        .orderBy(desc(links.clicks))
        .limit(limit);

    return c.json(data);
});

// Recent links (user-scoped)
app.get('/recent-links', async (c) => {
    const userId = c.get('userId' as never) as number;
    const limit = parseInt(c.req.query('limit') || '5');

    const data = await db
        .select()
        .from(links)
        .where(eq(links.userId, userId))
        .orderBy(desc(links.createdAt))
        .limit(limit);

    return c.json(data);
});

export default app;
