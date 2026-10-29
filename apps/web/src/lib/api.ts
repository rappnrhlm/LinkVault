import type {
  Collection,
  ImportPayload,
  Item,
  ItemDetail,
  Relationship,
  Tag,
} from '@linkvault/shared';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new ApiRequestError(
      body?.error ?? `Request failed (${response.status})`,
      response.status,
      body?.code ?? 'ERROR',
      body?.details,
    );
  }
  return body as T;
}

export interface Overview {
  counts: {
    active: number;
    bookmarks: number;
    notes: number;
    unread: number;
    favorites: number;
    archived: number;
    trash: number;
    tags: number;
    collections: number;
  };
  recent: Item[];
  unread: Item[];
  recentNotes: Item[];
  tags: Tag[];
  collections: Collection[];
}

export interface ListParams {
  type?: 'bookmark' | 'note';
  status?: 'active' | 'archived' | 'trash';
  favorite?: 'true';
  read?: 'true' | 'false';
  tag?: string;
  collection?: string;
  q?: string;
  sort?: 'updated' | 'created' | 'title';
  limit?: number;
  offset?: number;
}

function query<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, unknown][]) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const value = search.toString();
  return value ? `?${value}` : '';
}

export const api = {
  overview: () => request<Overview>('/overview'),
  listItems: (params: ListParams = {}) =>
    request<{ items: Item[]; total: number }>(`/items${query(params)}`),
  item: (id: string) => request<{ item: ItemDetail }>(`/items/${id}`),
  createBookmark: (input: {
    url: string;
    title?: string;
    description?: string;
    tags?: string[];
  }) =>
    request<{ item: ItemDetail; warning: string | null }>('/items/bookmarks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  createNote: (input: { title?: string; contentMd?: string }) =>
    request<{ item: ItemDetail }>('/items/notes', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateItem: (
    id: string,
    patch: {
      title?: string;
      favorite?: boolean;
      archived?: boolean;
      deleted?: boolean;
      bookmark?: {
        title?: string;
        url?: string;
        description?: string;
        siteName?: string;
        faviconUrl?: string | null;
        isRead?: boolean;
      };
    },
  ) => request<{ item: ItemDetail }>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  trashItem: (id: string) => request<{ item: ItemDetail }>(`/items/${id}`, { method: 'DELETE' }),
  deleteForever: (id: string) =>
    request<{ ok: boolean }>(`/items/${id}?permanent=true`, { method: 'DELETE' }),
  restoreItem: (id: string) =>
    request<{ item: ItemDetail }>(`/items/${id}/restore`, { method: 'POST' }),
  visitBookmark: (id: string) =>
    request<{ item: ItemDetail }>(`/items/${id}/visit`, { method: 'POST' }),
  saveNote: (id: string, contentMd: string, editorMode: 'markdown' | 'rich', baseUpdatedAt?: string) =>
    request<{ item: ItemDetail }>(`/items/${id}/note`, {
      method: 'PUT',
      body: JSON.stringify({ contentMd, editorMode, baseUpdatedAt }),
    }),
  setTags: (id: string, names: string[]) =>
    request<{ item: ItemDetail }>(`/items/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ names }),
    }),
  setCollections: (id: string, collectionIds: string[]) =>
    request<{ item: ItemDetail }>(`/items/${id}/collections`, {
      method: 'PUT',
      body: JSON.stringify({ collectionIds }),
    }),
  addRelationship: (id: string, targetItemId: string, kind: 'related' | 'references' = 'related') =>
    request<{ item: ItemDetail }>(`/items/${id}/relationships`, {
      method: 'POST',
      body: JSON.stringify({ targetItemId, kind }),
    }),
  removeRelationship: (id: string) =>
    request<{ ok: boolean }>(`/relationships/${id}`, { method: 'DELETE' }),
  tags: () => request<{ tags: Tag[] }>('/tags'),
  createTag: (name: string, color?: string) =>
    request<{ tag: Tag }>('/tags', { method: 'POST', body: JSON.stringify({ name, color }) }),
  updateTag: (id: string, patch: { name?: string; color?: string }) =>
    request<{ tags: Tag[] }>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTag: (id: string) => request<{ ok: boolean }>(`/tags/${id}`, { method: 'DELETE' }),
  collections: () => request<{ collections: Collection[] }>('/collections'),
  collection: (id: string) =>
    request<{ collection: Collection; items: Item[] }>(`/collections/${id}`),
  createCollection: (input: { name: string; description?: string }) =>
    request<{ collection: Collection }>('/collections', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateCollection: (id: string, input: { name?: string; description?: string }) =>
    request<{ collection: Collection }>(`/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteCollection: (id: string) =>
    request<{ ok: boolean }>(`/collections/${id}`, { method: 'DELETE' }),
  setCollectionItems: (id: string, itemIds: string[]) =>
    request<{ collection: Collection }>(`/collections/${id}/items`, {
      method: 'PUT',
      body: JSON.stringify({ itemIds }),
    }),
  search: (q: string) =>
    request<{ query: string; results: { item: Item; snippet: string }[] }>(
      `/search${query({ q })}`,
    ),
  exportAll: async () => {
    const response = await fetch('/api/export');
    if (!response.ok) throw new ApiRequestError('Export failed', response.status, 'EXPORT');
    return (await response.json()) as ImportPayload;
  },
  importAll: (data: ImportPayload) =>
    request<{ imported: number; skipped: number }>('/import', {
      method: 'POST',
      body: JSON.stringify({ mode: 'merge', data }),
    }),
  backup: () => request<{ ok: boolean; file: string }>('/backup', { method: 'POST' }),
  metadata: (url: string) =>
    request<{ metadata: { title: string; description: string; siteName: string; faviconUrl: string | null } }>(
      '/metadata',
      { method: 'POST', body: JSON.stringify({ url }) },
    ),
};

export type { Item, ItemDetail, Tag, Collection, Relationship };
