import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { collectionInputSchema, collectionUpdateSchema } from '@linkvault/shared';
import {
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  listItems,
  setCollectionItems,
  updateCollection,
} from '../repo.js';
import { ApiError } from '../services/items.js';
import { parse } from './util.js';

const itemsBody = z.object({ itemIds: z.array(z.string().uuid()).max(500) });

export default async function collectionRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/api/collections', async () => ({ collections: listCollections(db) }));

  app.post('/api/collections', async (request, reply) => {
    const input = parse(collectionInputSchema, request.body);
    return reply.code(201).send({ collection: createCollection(db, input) });
  });

  app.get<{ Params: { id: string } }>('/api/collections/:id', async (request) => {
    const collection = getCollection(db, request.params.id);
    if (!collection) throw new ApiError(404, 'Collection not found', 'NOT_FOUND');
    const { items } = listItems(db, {
      status: 'active',
      collection: request.params.id,
      sort: 'updated',
      limit: 200,
      offset: 0,
    });
    return { collection, items };
  });

  app.patch<{ Params: { id: string } }>('/api/collections/:id', async (request) => {
    const input = parse(collectionUpdateSchema, request.body);
    const collection = updateCollection(db, request.params.id, input);
    if (!collection) throw new ApiError(404, 'Collection not found', 'NOT_FOUND');
    return { collection };
  });

  app.delete<{ Params: { id: string } }>('/api/collections/:id', async (request) => {
    if (!deleteCollection(db, request.params.id)) {
      throw new ApiError(404, 'Collection not found', 'NOT_FOUND');
    }
    return { ok: true };
  });

  app.put<{ Params: { id: string } }>('/api/collections/:id/items', async (request) => {
    const { itemIds } = parse(itemsBody, request.body);
    if (!getCollection(db, request.params.id)) {
      throw new ApiError(404, 'Collection not found', 'NOT_FOUND');
    }
    setCollectionItems(db, request.params.id, itemIds);
    return { collection: getCollection(db, request.params.id) };
  });
}
