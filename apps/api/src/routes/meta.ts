import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fetchFavicon, fetchMetadata } from '../services/metadata.js';
import { parse } from './util.js';

const body = z.object({ url: z.string().trim().min(1).max(4096) });

export default async function metaRoutes(app: FastifyInstance) {
  app.post('/api/metadata', async (request) => {
    const { url } = parse(body, request.body);
    return { metadata: await fetchMetadata(url) };
  });

  const cache = new Map<string, { body: Buffer; contentType: string; expires: number }>();

  app.get<{ Querystring: { url?: string } }>('/api/favicon', async (request, reply) => {
    const url = parse(z.object({ url: z.string().trim().min(1).max(2048) }), request.query).url;
    const cached = cache.get(url);
    if (cached && cached.expires > Date.now()) {
      return reply.type(cached.contentType).header('cache-control', 'private, max-age=3600').send(cached.body);
    }
    const icon = await fetchFavicon(url);
    if (cache.size > 200) cache.clear();
    cache.set(url, { ...icon, expires: Date.now() + 60 * 60 * 1000 });
    return reply.type(icon.contentType).header('cache-control', 'private, max-age=3600').send(icon.body);
  });
}
