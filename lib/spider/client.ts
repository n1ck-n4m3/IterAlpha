export class SpiderRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {super(message); this.name = 'SpiderRequestError'; this.status = status;}
}
/** Serialize ledger writes without retaining a rejected tail or queuing market backlogs. */
export class SpiderQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation); this.tail = next.catch(() => {}); return next;
  }
}
export function isNewerVersion(current: {id: string; version: number} | null, next: {id: string; version: number}) {
  return !current || current.id !== next.id || next.version >= current.version;
}
export async function spiderRequest<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, {signal: controller.signal, credentials: 'same-origin', ...(body === undefined ? {} : {method: 'POST', headers: {'Content-Type': 'application/json', 'X-IterAlpha-Request': '1'}, body: JSON.stringify(body)})});
    const value = await response.json().catch(() => null) as T & {error?: string} | null;
    if (!response.ok) throw new SpiderRequestError(value?.error ?? 'The spider request failed. Please retry.', response.status);
    if (!value) throw new SpiderRequestError('The server returned an unreadable response. Please retry.', 502);
    return value;
  } catch (error) {
    if (controller.signal.aborted) throw new SpiderRequestError('The request timed out. Reload the saved account before retrying.', 408);
    throw error;
  } finally {clearTimeout(timeout);}
}
