export type ClientActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function unwrapActionResult<T>(
  result: ClientActionResult<T>,
  fallbackMessage: string,
) {
  if (!result.ok) {
    throw new Error(result.error ?? fallbackMessage);
  }

  return result.data;
}
