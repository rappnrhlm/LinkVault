import type { ZodTypeAny, z } from 'zod';
import { ApiError } from '../services/items.js';

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, issue?.message ?? 'Invalid request', 'VALIDATION', result.error.issues);
  }
  return result.data;
}
