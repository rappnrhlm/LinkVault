import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { openDb, type DB } from './db.js';
import { ApiError } from './services/items.js';
import { MetadataError, UnsafeUrlError } from './services/metadata.js';
import registerItems from './routes/items.js';
import registerTags from './routes/tags.js';
import registerCollections from './routes/collections.js';
import registerSearch from './routes/search.js';
import registerData from './routes/data.js';
import registerMeta from './routes/meta.js';
import registerRapbot from './routes/rapbot.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: DB;
    dbPath: string;
  }
}

export interface AppOptions {
  dbPath?: string;
  logger?: boolean;
  serveWeb?: boolean;
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const dbPath = options.dbPath ?? process.env.LINKVAULT_DB ?? 'data/linkvault.db';
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 16 * 1024 * 1024,
  });
  const db = openDb(dbPath);
  app.decorate('db', db);
  app.decorate('dbPath', dbPath);

  app.addHook('onClose', async () => {
    db.close();
  });

  app.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host ?? '';
    if (!LOCAL_HOST.test(host)) {
      return reply.code(403).send({ error: 'Requests must target localhost' });
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && !LOCAL_ORIGIN.test(origin)) {
        return reply.code(403).send({ error: 'Origin not allowed' });
      }
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-frame-options', 'DENY');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (String(reply.getHeader('content-type') ?? '').includes('text/html')) {
      reply.header(
        'content-security-policy',
        "default-src 'self'; img-src 'self' data: https: http:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    }
    return payload;
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || LOCAL_ORIGIN.test(origin)) callback(null, true);
      else callback(new Error('Origin not allowed'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type'],
    credentials: false,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: error.issues[0]?.message ?? 'Invalid request',
        code: 'VALIDATION',
        issues: error.issues,
      });
    }
    if (error instanceof ApiError) {
      return reply
        .code(error.status)
        .send({ error: error.message, code: error.code, details: error.details });
    }
    if (error instanceof MetadataError) {
      return reply.code(error.status).send({ error: error.message, code: 'METADATA' });
    }
    if (error instanceof UnsafeUrlError) {
      return reply.code(400).send({ error: error.message, code: 'UNSAFE_URL' });
    }
    if ((error as { validation?: unknown }).validation) {
      return reply.code(400).send({ error: 'Invalid request', code: 'VALIDATION' });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.code(status).send({ error: (error as Error).message, code: 'REQUEST' });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Something went wrong on this device', code: 'INTERNAL' });
  });

  app.get('/api/health', async () => ({ ok: true, version: 1 }));

  await app.register(registerItems);
  await app.register(registerTags);
  await app.register(registerCollections);
  await app.register(registerSearch);
  await app.register(registerData);
  await app.register(registerMeta);
  await app.register(registerRapbot);

  if (options.serveWeb) {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const webDist = join(here, '..', '..', 'web', 'dist');
    if (existsSync(join(webDist, 'index.html'))) {
      await app.register(fastifyStatic, { root: webDist, wildcard: false });
      app.setNotFoundHandler((request, reply) => {
        if (request.url.startsWith('/api/')) {
          return reply.code(404).send({ error: 'Not found', code: 'NOT_FOUND' });
        }
        return reply.type('text/html').sendFile('index.html');
      });
    } else {
      app.log.warn('Web build not found. Run `npm run build` first.');
    }
  }

  return app;
}
