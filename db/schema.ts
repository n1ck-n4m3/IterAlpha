import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), sceneId: text('scene_id').notNull(),
  version: integer('version').notNull(), status: text('status').notNull(), payload: text('payload').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, table => [index('sessions_owner_updated').on(table.owner, table.updatedAt)]);

export const coachRequests = sqliteTable('coach_requests', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), sessionId: text('session_id').notNull(),
  question: text('question').notNull(), status: text('status').notNull(), response: text('response'), createdAt: text('created_at').notNull(),
}, table => [index('coach_owner_created').on(table.owner, table.createdAt), index('coach_session').on(table.sessionId)]);

export const earlyAccessSignups = sqliteTable('early_access_signups', {
  email: text('email').primaryKey(), track: text('track').notNull(), source: text('source').notNull(),
  consentAt: text('consent_at').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});

export const siteVisits = sqliteTable('site_visits', {
  id: text('id').primaryKey(),
  visitorHash: text('visitor_hash').notNull(),
  email: text('email'),
  page: text('page').notNull(),
  bucket: integer('bucket').notNull(),
  occurredAt: text('occurred_at').notNull(),
}, table => [
  uniqueIndex('site_visits_visitor_page_bucket').on(table.visitorHash, table.page, table.bucket),
  index('site_visits_occurred_at').on(table.occurredAt),
]);
