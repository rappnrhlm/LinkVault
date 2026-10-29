import type { FastifyInstance } from 'fastify';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { importSchema } from '@linkvault/shared';
import { z } from 'zod';
import { exportAll, importAll } from '../repo.js';
import { ApiError } from '../services/items.js';
import { parse } from './util.js';

const importBody = z.object({
  mode: z.literal('merge').default('merge'),
  data: importSchema,
});

export default async function dataRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/api/about', async () => ({
    database: resolve(app.dbPath),
    backups: join(dirname(resolve(app.dbPath)), 'backups'),
  }));

  app.get('/api/export', async (_request, reply) => {
    const payload = exportAll(db);
    reply
      .type('application/json')
      .header('content-disposition', 'attachment; filename="linkvault-export.json"');
    return JSON.stringify(payload, null, 2);
  });

  app.post('/api/import', async (request) => {
    const { data } = parse(importBody, request.body);
    try {
      return { ...importAll(db, data), mode: 'merge' as const };
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? `Import failed: ${error.message}` : 'Import failed',
        'IMPORT_FAILED',
      );
    }
  });

  app.post('/api/backup', async () => {
    if (app.dbPath === ':memory:') throw new ApiError(400, 'In-memory databases cannot be backed up', 'NO_BACKUP');
    const source = resolve(app.dbPath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const directory = join(dirname(source), 'backups');
    mkdirSync(directory, { recursive: true });
    const target = join(directory, `linkvault-${stamp}.db`);
    db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
    return { ok: true, file: target };
  });
}
