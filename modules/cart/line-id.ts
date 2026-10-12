const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True for a cart line row. Optimistic drawer ids are not UUIDs. */
export function isPersistedCartLineId(id: string): boolean {
  return UUID_RE.test(id);
}
