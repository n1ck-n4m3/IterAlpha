import type { CoachReply, Session } from '../training/types.ts';
import { TrainingError } from '../training/engine.ts';

export class Repository {
  db: D1Database;
  constructor(db: D1Database) { this.db = db; }
  async recordVisit(visitorHash: string, email: string | null, page: string, now: string) {
    const bucket = Math.floor(Date.parse(now) / 900_000);
    await this.db.prepare('INSERT OR IGNORE INTO site_visits (id, visitor_hash, email, page, bucket, occurred_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(),visitorHash,email,page,bucket,now).run();
    await this.db.prepare('DELETE FROM site_visits WHERE occurred_at < ?')
      .bind(new Date(Date.parse(now)-30*24*60*60*1000).toISOString()).run();
  }
  async visitReport(now: string) {
    const since = new Date(Date.parse(now)-30*24*60*60*1000).toISOString();
    const summary = await this.db.prepare(`SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors,
      COUNT(DISTINCT CASE WHEN email IS NOT NULL THEN visitor_hash END) AS accounts
      FROM site_visits WHERE occurred_at >= ?`).bind(since).first<{views:number;visitors:number;accounts:number}>();
    const pages = await this.db.prepare('SELECT page, COUNT(*) AS views FROM site_visits WHERE occurred_at >= ? GROUP BY page ORDER BY views DESC')
      .bind(since).all<{page:string;views:number}>();
    const visits = await this.db.prepare('SELECT email, page, occurred_at, substr(visitor_hash,1,12) AS visitor FROM site_visits WHERE occurred_at >= ? ORDER BY occurred_at DESC LIMIT 100')
      .bind(since).all<{email:string|null;page:string;occurred_at:string;visitor:string}>();
    const leads = await this.db.prepare('SELECT COUNT(*) AS total FROM early_access_signups').first<{total:number}>();
    return {summary:summary??{views:0,visitors:0,accounts:0},pages:pages.results,visits:visits.results,leads:leads?.total??0};
  }
  async claimGuestSessions(guestOwner: string, signedOwner: string) {
    if (guestOwner===signedOwner) return;
    const rows=await this.db.prepare('SELECT id, payload FROM sessions WHERE owner = ?').bind(guestOwner).all<{id:string;payload:string}>();
    for (const row of rows.results) {
      const session=JSON.parse(row.payload) as Session;
      session.owner=signedOwner;
      await this.db.prepare('UPDATE sessions SET owner = ?, payload = ? WHERE id = ? AND owner = ?')
        .bind(signedOwner,JSON.stringify(session),row.id,guestOwner).run();
    }
  }
  async signUp(email: string, track: 'foundations' | 'advanced' | 'undecided', source: string, now: string) {
    await this.db.prepare(`INSERT INTO early_access_signups (email,track,source,consent_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET track = excluded.track, source = excluded.source,
      consent_at = excluded.consent_at, updated_at = excluded.updated_at`)
      .bind(email,track,source,now,now,now).run();
  }
  async find(owner: string, id: string): Promise<Session | null> {
    const row = await this.db.prepare('SELECT payload FROM sessions WHERE id = ? AND owner = ?').bind(id,owner).first<{payload:string}>();
    return row ? JSON.parse(row.payload) : null;
  }
  async list(owner: string): Promise<Session[]> {
    const result = await this.db.prepare('SELECT payload FROM sessions WHERE owner = ? ORDER BY updated_at DESC LIMIT 100').bind(owner).all<{payload:string}>();
    return result.results.map(row => JSON.parse(row.payload));
  }
  async create(session: Session) {
    const day = session.createdAt.slice(0,10);
    const result = await this.db.prepare(`INSERT OR IGNORE INTO sessions (id,owner,scene_id,version,status,payload,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM sessions WHERE owner = ? AND created_at >= ?) < 30`)
      .bind(session.id,session.owner,session.sceneId,session.version,session.status,JSON.stringify(session),session.createdAt,session.updatedAt,session.owner,day).run();
    if (!result.meta.changes) {
      const existing = await this.find(session.owner,session.id);
      if (existing && existing.sceneId === session.sceneId) return existing;
      throw new TrainingError('The session could not be created. Daily limit: 30 rounds.',429);
    }
    return session;
  }
  async save(previous: Session, next: Session) {
    if (previous.version === next.version) return true;
    const result = await this.db.prepare('UPDATE sessions SET version = ?, status = ?, payload = ?, updated_at = ? WHERE id = ? AND owner = ? AND version = ?')
      .bind(next.version,next.status,JSON.stringify(next),next.updatedAt,next.id,next.owner,previous.version).run();
    return result.meta.changes === 1;
  }
  async coach(owner: string, sessionId: string, id: string) {
    return this.db.prepare('SELECT question, status, response, created_at FROM coach_requests WHERE id = ? AND owner = ? AND session_id = ?').bind(id,owner,sessionId).first<{question:string;status:string;response:string|null;created_at:string}>();
  }
  async coaching(owner: string, sessionId: string): Promise<CoachReply[]> {
    const rows = await this.db.prepare("SELECT response FROM coach_requests WHERE owner = ? AND session_id = ? AND status = ? AND id NOT LIKE '%:step:%' ORDER BY created_at ASC").bind(owner,sessionId,'completed').all<{response:string}>();
    return rows.results.map(row=>JSON.parse(row.response));
  }
  async reserveCoach(owner: string, sessionId: string, id: string, question: string, now: string) {
    const result = await this.db.prepare(`INSERT OR IGNORE INTO coach_requests (id,owner,session_id,question,status,created_at)
      SELECT ?,?,?,?,'pending',? WHERE (SELECT COUNT(*) FROM coach_requests WHERE owner = ? AND created_at >= ?) < 20
      AND (SELECT COUNT(*) FROM coach_requests WHERE owner = ? AND session_id = ? AND id NOT LIKE '%:step:%') < 4`)
      .bind(id,owner,sessionId,question,now,owner,now.slice(0,10),owner,sessionId).run();
    return result.meta.changes === 1;
  }
  async reserveStepCoach(owner:string,sessionId:string,id:string,now:string){
    const result=await this.db.prepare(`INSERT OR IGNORE INTO coach_requests (id,owner,session_id,question,status,created_at)
      SELECT ?,?,?,'','pending',? WHERE (SELECT COUNT(*) FROM coach_requests WHERE owner = ? AND created_at >= ?) < 20
      AND (SELECT COUNT(*) FROM coach_requests WHERE owner = ? AND session_id = ? AND id LIKE ?) < 8`)
      .bind(id,owner,sessionId,now,owner,now.slice(0,10),owner,sessionId,`${sessionId}:step:%`).run();
    return result.meta.changes===1;
  }
  async finishCoach(owner: string, id: string, reply: CoachReply) {
    await this.db.prepare('UPDATE coach_requests SET status = ?, response = ? WHERE id = ? AND owner = ?').bind('completed',JSON.stringify(reply),id,owner).run();
  }
}
