import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { searchItems } from '../repo.js';
import { parse } from './util.js';

const searchQuery = z.object({
  q: z.string().trim().min(1).max(300),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export default async function searchRoutes(app: FastifyInstance) {
  app.get('/api/search', async (request) => {
    const { q, limit } = parse(searchQuery, request.query);
    return { query: q, results: searchItems(app.db, q, limit) };
  });
}
