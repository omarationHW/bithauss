/** Une listas sin repetir expediente, del más reciente al más antiguo. */
export function mergeExpedientes<T extends { id: string; created_at: string }>(lists: T[][]): T[] {
  const byId = new Map(lists.flat().map((e) => [e.id, e]));
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
