/**
 * Persistent Anti-Spam Tracker for Cloudflare Workers
 * Uses Cloudflare D1 for persistent rate-limiting and duplicate detection across edge requests.
 */

import { normalizeTextForSpam } from '../lib/moderation';

export interface SpamCheckResult {
  isSpam: boolean;
  reason: string;
}

export class D1SpamTracker {
  constructor(private readonly db?: D1Database) {}

  /**
   * Hashes text using Web Crypto SHA-256 for duplicate matching.
   */
  async hashText(text: string): Promise<string> {
    const norm = normalizeTextForSpam(text);
    const msgUint8 = new TextEncoder().encode(norm);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Records a user's message and checks whether it exceeds burst rate or duplicate limits.
   */
  async recordAndCheck(
    userId: number,
    text: string,
    burstLimit: number = 5,
    burstWindowSeconds: number = 8,
    duplicateLimit: number = 3,
    duplicateWindowSeconds: number = 30,
    nowEpoch: number = Math.floor(Date.now() / 1000)
  ): Promise<SpamCheckResult> {
    if (!this.db) {
      // If no D1 database is bound, allow message to avoid blocking users
      return { isSpam: false, reason: '' };
    }

    try {
      const hash = await this.hashText(text);

      // 1. Check burst rate
      const burstThreshold = nowEpoch - burstWindowSeconds;
      const burstQuery = await this.db
        .prepare('SELECT COUNT(*) as count FROM spam_tracker WHERE user_id = ? AND timestamp >= ?')
        .bind(userId, burstThreshold)
        .first<{ count: number }>();

      const recentCount = (burstQuery?.count ?? 0) + 1;
      if (recentCount > burstLimit) {
        return {
          isSpam: true,
          reason: `Excessive posting rate (${recentCount} messages in under ${burstWindowSeconds}s)`,
        };
      }

      // 2. Check duplicate message count (only for messages with >= 4 normalized characters)
      const normText = normalizeTextForSpam(text);
      if (normText.length >= 4) {
        const dupeThreshold = nowEpoch - duplicateWindowSeconds;
        const dupeQuery = await this.db
          .prepare(
            'SELECT COUNT(*) as count FROM spam_tracker WHERE user_id = ? AND message_hash = ? AND timestamp >= ?'
          )
          .bind(userId, hash, dupeThreshold)
          .first<{ count: number }>();

        const dupeCount = (dupeQuery?.count ?? 0) + 1;
        if (dupeCount >= duplicateLimit) {
          return {
            isSpam: true,
            reason: `Repeated message detected (${dupeCount} identical messages within ${duplicateWindowSeconds}s)`,
          };
        }
      }

      // 3. Record this message in D1
      await this.db
        .prepare('INSERT INTO spam_tracker (user_id, timestamp, message_hash) VALUES (?, ?, ?)')
        .bind(userId, nowEpoch, hash)
        .run();

      // 4. Prune old spam entries (> 300 seconds ago) to keep D1 compact
      // Run occasionally (approx 1 in 20 requests)
      if (Math.random() < 0.05) {
        const pruneThreshold = nowEpoch - 300;
        await this.db.prepare('DELETE FROM spam_tracker WHERE timestamp < ?').bind(pruneThreshold).run();
      }

      return { isSpam: false, reason: '' };
    } catch (err: any) {
      // In case of database error, fail-open to avoid disrupting group conversations
      console.error('Error during D1 spam check:', err.message);
      return { isSpam: false, reason: '' };
    }
  }
}
