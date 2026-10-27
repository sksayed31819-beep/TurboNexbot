/**
 * Cloudflare D1-Backed Channel Post Scheduler & Cron Trigger Processor
 */

import { TelegramClient } from './telegram';
import { ScheduledPostRecord } from './types';

export class PostSchedulerD1 {
  constructor(private readonly db?: D1Database) {}

  /**
   * Schedules a new post in Cloudflare D1.
   */
  async schedulePost(
    channelId: string,
    content: string,
    scheduledEpoch: number,
    createdBy: number,
    parseMode: string = 'Markdown'
  ): Promise<ScheduledPostRecord> {
    if (!this.db) {
      throw new Error('D1 Database binding (DB) is required to schedule posts.');
    }

    const now = Math.floor(Date.now() / 1000);
    if (scheduledEpoch < now - 60) {
      throw new Error('Scheduled publication time cannot be in the past.');
    }
    if (!content || !content.trim()) {
      throw new Error('Post content cannot be empty.');
    }

    const postId = crypto.randomUUID().slice(0, 8);
    const cleanContent = content.trim();

    await this.db
      .prepare(
        `INSERT INTO scheduled_posts (id, channel_id, content, scheduled_epoch, created_by, parse_mode, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .bind(postId, channelId.trim(), cleanContent, scheduledEpoch, createdBy, parseMode, now)
      .run();

    return {
      id: postId,
      channel_id: channelId.trim(),
      content: cleanContent,
      scheduled_epoch: scheduledEpoch,
      created_by: createdBy,
      parse_mode: parseMode,
      status: 'pending',
      created_at: now,
    };
  }

  /**
   * Retrieves all scheduled posts, ordered by scheduled time.
   */
  async listPosts(status?: string): Promise<ScheduledPostRecord[]> {
    if (!this.db) return [];

    let query = 'SELECT * FROM scheduled_posts';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY scheduled_epoch DESC LIMIT 100';

    const result = await this.db.prepare(query).bind(...params).all<ScheduledPostRecord>();
    return result.results || [];
  }

  /**
   * Cancels a pending scheduled post.
   */
  async cancelPost(postId: string): Promise<boolean> {
    if (!this.db) return false;

    const res = await this.db
      .prepare("UPDATE scheduled_posts SET status = 'canceled' WHERE id = ? AND status = 'pending'")
      .bind(postId)
      .run();

    return (res.meta.changes ?? 0) > 0;
  }

  /**
   * Immediately publishes a specific post to Telegram and marks it as published.
   * Atomically acquires an exclusive lease to guarantee concurrent executions cannot duplicate publication.
   */
  async publishPostNow(client: TelegramClient, postId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.db) {
      return { success: false, error: 'Database binding unavailable.' };
    }

    // Atomically transition from 'pending' to 'publishing' to lock out concurrent triggers
    const claimRes = await this.db
      .prepare("UPDATE scheduled_posts SET status = 'publishing' WHERE id = ? AND status = 'pending'")
      .bind(postId)
      .run();

    if ((claimRes.meta.changes ?? 0) === 0) {
      // Check current state for informative error
      const existing = await this.db
        .prepare('SELECT status FROM scheduled_posts WHERE id = ?')
        .bind(postId)
        .first<{ status: string }>();

      if (!existing) {
        return { success: false, error: 'Post not found.' };
      }
      return {
        success: false,
        error: `Post cannot be published: current status is '${existing.status}' (already published, canceling, or currently being processed).`,
      };
    }

    const post = await this.db
      .prepare('SELECT * FROM scheduled_posts WHERE id = ?')
      .bind(postId)
      .first<ScheduledPostRecord>();

    if (!post) {
      return { success: false, error: 'Post record vanished after claim.' };
    }

    const now = Math.floor(Date.now() / 1000);
    try {
      const res = await client.sendMessage(post.channel_id, post.content, {
        parse_mode: (post.parse_mode as any) || 'Markdown',
      });

      if (res.ok) {
        await this.db
          .prepare("UPDATE scheduled_posts SET status = 'published', published_at = ?, error_message = NULL WHERE id = ?")
          .bind(now, postId)
          .run();
        return { success: true };
      } else {
        const errMsg = res.description || 'Telegram rejected channel broadcast';
        await this.db
          .prepare("UPDATE scheduled_posts SET status = 'failed', error_message = ? WHERE id = ?")
          .bind(errMsg, postId)
          .run();
        return { success: false, error: errMsg };
      }
    } catch (err: any) {
      const errMsg = err.message || 'Network exception while dispatching post';
      await this.db
        .prepare("UPDATE scheduled_posts SET status = 'failed', error_message = ? WHERE id = ?")
        .bind(errMsg, postId)
        .run();
      return { success: false, error: errMsg };
    }
  }

  /**
   * Invoked by Cloudflare Cron Triggers (e.g. every minute) to dispatch due posts.
   * Uses atomic database status transition ('pending' -> 'publishing') to guarantee
   * that concurrent cron executions cannot publish the same post twice.
   */
  async processDuePosts(client: TelegramClient, nowEpoch: number = Math.floor(Date.now() / 1000)): Promise<number> {
    if (!this.db) return 0;

    const duePosts = await this.db
      .prepare(
        "SELECT * FROM scheduled_posts WHERE status = 'pending' AND scheduled_epoch <= ? ORDER BY scheduled_epoch ASC LIMIT 10"
      )
      .bind(nowEpoch)
      .all<ScheduledPostRecord>();

    if (!duePosts.results || duePosts.results.length === 0) {
      return 0;
    }

    let publishedCount = 0;

    for (const post of duePosts.results) {
      // Concurrency lock: Atomically claim this post
      const claimRes = await this.db
        .prepare("UPDATE scheduled_posts SET status = 'publishing' WHERE id = ? AND status = 'pending'")
        .bind(post.id)
        .run();

      if ((claimRes.meta.changes ?? 0) === 0) {
        // Another concurrent Cron trigger or admin execution already claimed this post; skip!
        continue;
      }

      try {
        const res = await client.sendMessage(post.channel_id, post.content, {
          parse_mode: (post.parse_mode as any) || 'Markdown',
        });

        if (res.ok) {
          await this.db
            .prepare(
              "UPDATE scheduled_posts SET status = 'published', published_at = ?, error_message = NULL WHERE id = ?"
            )
            .bind(nowEpoch, post.id)
            .run();
          publishedCount++;
        } else {
          const safeErr = res.description || 'Telegram rejected send';
          await this.db
            .prepare("UPDATE scheduled_posts SET status = 'failed', error_message = ? WHERE id = ?")
            .bind(safeErr.slice(0, 150), post.id)
            .run();
        }
      } catch (err: any) {
        await this.db
          .prepare("UPDATE scheduled_posts SET status = 'failed', error_message = ? WHERE id = ?")
          .bind((err.message || 'Dispatch error').slice(0, 150), post.id)
          .run();
      }
    }

    return publishedCount;
  }
}
