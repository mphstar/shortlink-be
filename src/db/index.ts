import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import { resolve } from 'path';

const dbPath = resolve(process.cwd(), 'data', 'shortlink.db');

const client = createClient({
    url: `file:${dbPath}`,
});

export const db = drizzle(client, { schema });
