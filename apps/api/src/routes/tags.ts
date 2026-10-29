import type { FastifyInstance } from 'fastify';
import { tagInputSchema, tagUpdateSchema } from '@linkvault/shared';
import { ensureTag, listTags, normalizeTagName, reindexAll } from '../repo.js';
import { ApiError } from '../services/items.js';
import { parse } from './util.js';

export default async function tagRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/api/tags', async () => ({ tags: listTags(db) }));

  app.post('/api/tags', async (request, reply) => {
    const input = parse(tagInputSchema, request.body);
    const normalized = normalizeTagName(input.name);
    const existing = db.prepare('select id from tags where normalized_name = ?').get(normalized);
    if (existing) throw new ApiError(409, 'That tag already exists', 'DUPLICATE_TAG');
    const tag = ensureTag(db, input.name);
    if (input.color) db.prepare('update tags set color = ? where id = ?').run(input.color, tag.id);
    return reply.code(201).send({ tag: { ...tag, color: input.color ?? tag.color } });
  });

  app.patch<{ Params: { id: string } }>('/api/tags/:id', async (request) => {
    const input = parse(tagUpdateSchema, request.body);
    const existing = db.prepare('select id from tags where id = ?').get(request.params.id);
    if (!existing) throw new ApiError(404, 'Tag not found', 'NOT_FOUND');
    if (input.name) {
      const normalized = normalizeTagName(input.name);
      const clash = db
        .prepare('select id from tags where normalized_name = ? and id <> ?')
        .get(normalized, request.params.id);
      if (clash) throw new ApiError(409, 'Another tag already uses that name', 'DUPLICATE_TAG');
      db.prepare('update tags set name = ?, normalized_name = ? where id = ?').run(
        input.name.trim().replace(/\s+/g, ' '),
        normalized,
        request.params.id,
      );
    }
    if (input.color) {
      db.prepare('update tags set color = ? where id = ?').run(input.color, request.params.id);
    }
    reindexAll(db);
    return { tags: listTags(db) };
  });

  app.delete<{ Params: { id: string } }>('/api/tags/:id', async (request) => {
    const result = db.prepare('delete from tags where id = ?').run(request.params.id);
    if (result.changes === 0) throw new ApiError(404, 'Tag not found', 'NOT_FOUND');
    reindexAll(db);
    return { ok: true };
  });
}
