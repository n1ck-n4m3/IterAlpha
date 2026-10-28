import type {Bot} from '../spider/types.ts';

export class SpiderRepository {
  db: D1Database;
  constructor(db: D1Database) {this.db = db;}
  async find(owner: string, id: string): Promise<Bot | null> {
    const row = await this.db.prepare('SELECT payload FROM spiders WHERE owner = ? AND id = ?').bind(owner, id).first<{payload: string}>();
    return row ? JSON.parse(row.payload) : null;
  }
  async list(owner: string): Promise<Bot[]> {
    const result = await this.db.prepare('SELECT payload FROM spiders WHERE owner = ? ORDER BY updated_at DESC LIMIT 30').bind(owner).all<{payload: string}>();
    return result.results.map(row => JSON.parse(row.payload));
  }
  async running(): Promise<Bot[]> {
    const result = await this.db.prepare("SELECT payload FROM spiders WHERE status = 'running' AND COALESCE(json_extract(payload, '$.config.feedMode'), 'server') != 'browser' ORDER BY updated_at ASC LIMIT 20").all<{payload: string}>();
    return result.results.map(row => JSON.parse(row.payload));
  }
  async create(bot: Bot): Promise<boolean> {
    const result = await this.db.prepare(`INSERT OR IGNORE INTO spiders (id, owner, version, status, payload, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM spiders WHERE owner = ? AND status = 'running')
      AND (SELECT COUNT(*) FROM spiders WHERE owner = ? AND created_at >= ?) < 20`)
      .bind(bot.id, bot.owner, bot.version, bot.status, JSON.stringify(bot), bot.createdAt, bot.updatedAt, bot.owner, bot.owner, bot.createdAt - 86400000).run();
    return result.meta.changes === 1;
  }
  async save(previous: Bot, next: Bot): Promise<boolean> {
    if (previous.version === next.version) return true;
    const result = await this.db.prepare(`UPDATE spiders SET version = ?, status = ?, payload = ?, updated_at = ?
      WHERE id = ? AND owner = ? AND version = ? AND (? != 'running' OR NOT EXISTS
      (SELECT 1 FROM spiders other WHERE other.owner = ? AND other.status = 'running' AND other.id != ?))`)
      .bind(next.version, next.status, JSON.stringify(next), next.updatedAt, next.id, next.owner, previous.version, next.status, next.owner, next.id).run();
    return result.meta.changes === 1;
  }
}
