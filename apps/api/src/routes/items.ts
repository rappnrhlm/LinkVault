import type { FastifyInstance } from 'fastify';
import {
  createBookmarkSchema,
  createNoteSchema,
  listQuerySchema,
  noteContentSchema,
  relationshipInputSchema,
  updateItemSchema,
} from '@linkvault/shared';
import { z } from 'zod';
import { addRelationship, deleteRelationship, getItem, listItems, stats } from '../repo.js';
import {
  ApiError,
  createBookmark,
  createNote,
  permanentlyDelete,
  restoreItem,
  saveNoteContent,
  updateItem,
  visitBookmark,
} from '../services/items.js';
import { setItemCollections, setItemTags } from '../repo.js';
import { parse } from './util.js';

const tagsBody = z.object({ names: z.array(z.string().trim().min(1).max(60)).max(30) });
const collectionsBody = z.object({ collectionIds: z.array(z.string().uuid()).max(30) });

export default async function itemRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/api/overview', async () => stats(db));

  app.get('/api/items', async (request) => {
    const query = parse(listQuerySchema, request.query);
    return listItems(db, {
      ...query,
      favorite: query.favorite === 'true' ? true : undefined,
      read: query.read === 'true' ? true : query.read === 'false' ? false : undefined,
    });
  });

  app.post('/api/items/bookmarks', async (request, reply) => {
    const input = parse(createBookmarkSchema, request.body);
    const result = await createBookmark(db, input);
    return reply.code(201).send(result);
  });

  app.post('/api/items/notes', async (request, reply) => {
    const input = parse(createNoteSchema, request.body);
    return reply.code(201).send({ item: createNote(db, input) });
  });

  app.get<{ Params: { id: string } }>('/api/items/:id', async (request) => {
    const item = getItem(db, request.params.id);
    if (!item) throw new ApiError(404, 'Item not found', 'NOT_FOUND');
    return { item };
  });

  app.patch<{ Params: { id: string } }>('/api/items/:id', async (request) => {
    const patch = parse(updateItemSchema, request.body);
    return { item: updateItem(db, request.params.id, patch) };
  });

  app.delete<{ Params: { id: string }; Querystring: { permanent?: string } }>(
    '/api/items/:id',
    async (request) => {
      if (request.query.permanent === 'true') {
        permanentlyDelete(db, request.params.id);
        return { ok: true, permanent: true };
      }
      return { item: updateItem(db, request.params.id, { deleted: true }) };
    },
  );

  app.post<{ Params: { id: string } }>('/api/items/:id/restore', async (request) => {
    return { item: restoreItem(db, request.params.id) };
  });

  app.post<{ Params: { id: string } }>('/api/items/:id/visit', async (request) => {
    return { item: visitBookmark(db, request.params.id) };
  });

  app.put<{ Params: { id: string } }>('/api/items/:id/note', async (request) => {
    const input = parse(noteContentSchema, request.body);
    return { item: saveNoteContent(db, request.params.id, input) };
  });

  app.put<{ Params: { id: string } }>('/api/items/:id/tags', async (request) => {
    const { names } = parse(tagsBody, request.body);
    if (!getItem(db, request.params.id)) throw new ApiError(404, 'Item not found', 'NOT_FOUND');
    setItemTags(db, request.params.id, names);
    return { item: getItem(db, request.params.id) };
  });

  app.put<{ Params: { id: string } }>('/api/items/:id/collections', async (request) => {
    const { collectionIds } = parse(collectionsBody, request.body);
    if (!getItem(db, request.params.id)) throw new ApiError(404, 'Item not found', 'NOT_FOUND');
    setItemCollections(db, request.params.id, collectionIds);
    return { item: getItem(db, request.params.id) };
  });

  app.post<{ Params: { id: string } }>('/api/items/:id/relationships', async (request, reply) => {
    const input = parse(relationshipInputSchema, request.body);
    const source = getItem(db, request.params.id);
    if (!source) throw new ApiError(404, 'Item not found', 'NOT_FOUND');
    const target = getItem(db, input.targetItemId);
    if (!target) throw new ApiError(404, 'The item to link was not found', 'NOT_FOUND');
    if (source.id === target.id) throw new ApiError(400, 'An item cannot link to itself', 'SELF_LINK');
    try {
      addRelationship(db, source.id, target.id, input.kind);
    } catch (error) {
      throw new ApiError(409, error instanceof Error ? error.message : 'Could not link items', 'DUPLICATE_LINK');
    }
    return reply.code(201).send({ item: getItem(db, source.id) });
  });

  app.delete<{ Params: { id: string } }>('/api/relationships/:id', async (request) => {
    if (!deleteRelationship(db, request.params.id)) {
      throw new ApiError(404, 'Relationship not found', 'NOT_FOUND');
    }
    return { ok: true };
  });

}
