import { Hono } from 'hono';
import { db } from '../db/index.js';
import { links, clicks } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { parseUserAgent } from '../utils/shortcode.js';

const app = new Hono();

// Redirect handler
app.get('/:code', async (c) => {
    const code = c.req.param('code');

    const link = await db
        .select()
        .from(links)
        .where(eq(links.shortCode, code))
        .limit(1);

    const renderErrorPage = (title: string, message: string, code: number) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Shortlink</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #1A222C; color: #AEB7C0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .gradient-text { background: linear-gradient(135deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .card { background: #24303F; border: 1px solid #2E3A47; border-radius: 1rem; padding: 2.5rem; text-align: center; max-width: 28rem; width: 90%; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
        .btn-primary { background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 500; text-decoration: none; display: inline-block; margin-top: 1.5rem; transition: opacity 0.2s; box-shadow: 0 4px 14px 0 rgba(168, 85, 247, 0.39); }
        .btn-primary:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <div class="card">
        <h1 class="text-7xl font-bold mb-4 gradient-text">${code}</h1>
        <h2 class="text-2xl font-semibold text-white mb-2">${title}</h2>
        <p class="text-sm border border-strokedark p-3 rounded bg-[#1A222C] mb-4">${message}</p>
        <a href="http://localhost:5173" class="btn-primary">Back to Dashboard</a>
    </div>
</body>
</html>`;

    if (link.length === 0) {
        return c.html(renderErrorPage('Link Not Found', 'The short link you are trying to access does not exist or has been removed.', 404), 404);
    }

    if (!link[0].isActive) {
        return c.html(renderErrorPage('Link Deactivated', 'This link has been deactivated by the owner and is no longer available.', 410), 410);
    }

    // Parse user agent
    const userAgent = c.req.header('user-agent') || null;
    const { browser, os, device } = parseUserAgent(userAgent);

    // Record click asynchronously
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const referer = c.req.header('referer') || null;

    // Insert click record and increment counter
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

    return c.redirect(link[0].originalUrl, 302);
});

export default app;
