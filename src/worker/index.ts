/**
 * TurboNex Community Moderation Bot - Cloudflare Worker Entry Point
 * Handles Telegram Webhooks, Admin Management APIs, and Cloudflare Cron Triggers.
 */

import {
  containsPhoneNumber,
  containsUrl,
  formatWelcomeMessageTS,
  DEFAULT_CONFIG,
  ModerationConfig,
} from '../lib/moderation';
import {
  safeCompareStrings,
  validateTelegramWebhookSecret,
  isAuthorizedAdminApi,
  parseAdminIds,
  isUserAdmin,
  maskSecret,
  maskPhoneNumber,
} from './auth';
import { TelegramClient } from './telegram';
import { D1SpamTracker } from './spam';
import { PostSchedulerD1 } from './scheduler';
import { Env, TelegramUpdate, ModerationSettings } from './types';

/**
 * Loads dynamic moderation settings from Cloudflare D1, falling back to defaults.
 */
async function getSettingsFromDb(db?: D1Database): Promise<ModerationSettings> {
  const base: ModerationSettings = {
    delete_urls: DEFAULT_CONFIG.deleteUrls,
    delete_invites: DEFAULT_CONFIG.deleteInvites,
    delete_phone_numbers: DEFAULT_CONFIG.deletePhoneNumbers,
    anti_spam_enabled: DEFAULT_CONFIG.antiSpamEnabled,
    burst_limit: DEFAULT_CONFIG.burstLimit,
    burst_window_seconds: DEFAULT_CONFIG.burstWindowSeconds,
    duplicate_limit: DEFAULT_CONFIG.duplicateLimit,
    duplicate_window_seconds: DEFAULT_CONFIG.duplicateWindowSeconds,
    violation_action: DEFAULT_CONFIG.violationAction,
    welcome_enabled: DEFAULT_CONFIG.welcomeEnabled,
    welcome_template: DEFAULT_CONFIG.welcomeTemplate,
    rules_link: DEFAULT_CONFIG.rulesLink,
    community_name: DEFAULT_CONFIG.communityName,
    admin_ids: DEFAULT_CONFIG.adminIds,
  };

  if (!db) return base;

  try {
    const rows = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
    if (rows.results) {
      for (const row of rows.results) {
        if (row.key === 'delete_urls') base.delete_urls = row.value === 'true';
        if (row.key === 'delete_invites') base.delete_invites = row.value === 'true';
        if (row.key === 'delete_phone_numbers') base.delete_phone_numbers = row.value === 'true';
        if (row.key === 'anti_spam_enabled') base.anti_spam_enabled = row.value === 'true';
        if (row.key === 'burst_limit') base.burst_limit = parseInt(row.value, 10) || base.burst_limit;
        if (row.key === 'burst_window_seconds')
          base.burst_window_seconds = parseFloat(row.value) || base.burst_window_seconds;
        if (row.key === 'duplicate_limit')
          base.duplicate_limit = parseInt(row.value, 10) || base.duplicate_limit;
        if (row.key === 'duplicate_window_seconds')
          base.duplicate_window_seconds = parseFloat(row.value) || base.duplicate_window_seconds;
        if (row.key === 'violation_action') base.violation_action = row.value as any;
        if (row.key === 'welcome_enabled') base.welcome_enabled = row.value === 'true';
        if (row.key === 'welcome_template') base.welcome_template = row.value;
        if (row.key === 'rules_link') base.rules_link = row.value;
        if (row.key === 'community_name') base.community_name = row.value;
      }
    }
  } catch (err: any) {
    console.error('Failed to load settings from D1:', err.message);
  }

  return base;
}

/**
 * Saves a setting key/value into D1.
 */
async function updateSettingInDb(db: D1Database | undefined, key: string, value: string): Promise<boolean> {
  if (!db) return false;
  try {
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?')
      .bind(key, value, now, value, now)
      .run();
    return true;
  } catch (err: any) {
    console.error(`Failed to update setting ${key}:`, err.message);
    return false;
  }
}

/**
 * Records an incident into moderation_logs table.
 */
async function recordModerationLog(
  db: D1Database | undefined,
  chatId: string | number,
  userId: number,
  userHandle: string | undefined,
  action: string,
  violationType: string | null,
  reason: string,
  sanitizedDetail: string
) {
  if (!db) return;
  try {
    const logId = crypto.randomUUID().slice(0, 8);
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `INSERT INTO moderation_logs (id, timestamp, chat_id, user_id, user_handle, action, violation_type, reason, sanitized_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(logId, now, String(chatId), userId, userHandle || null, action, violationType, reason, sanitizedDetail)
      .run();
  } catch (err: any) {
    console.error('Failed to record moderation log:', err.message);
  }
}


export default {
  /**
   * Main HTTP handler for webhooks and admin APIs
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // -------------------------------------------------------------
    // 1. TELEGRAM WEBHOOK INBOUND ENDPOINT: POST /webhook or /api/telegram-webhook
    // -------------------------------------------------------------
    if (request.method === 'POST' && (url.pathname === '/webhook' || url.pathname === '/api/telegram-webhook')) {
      // Step A: Validate Telegram Secret Token header
      const isValid = validateTelegramWebhookSecret(request, env.TELEGRAM_SECRET_TOKEN);
      if (!isValid) {
        console.warn('Unauthorized webhook request rejected (invalid or missing X-Telegram-Bot-Api-Secret-Token).');
        return new Response('Unauthorized webhook request', { status: 401 });
      }

      // Step B: Parse Telegram Update
      let update: TelegramUpdate;
      try {
        update = (await request.json()) as TelegramUpdate;
      } catch (err: any) {
        return new Response('Invalid JSON payload', { status: 400 });
      }

      // Initialize Telegram client & storage
      const client = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
      const settings = await getSettingsFromDb(env.DB);
      const configuredAdminIds = parseAdminIds(env.ADMIN_IDS);
      // Combine env admin IDs with DB admin IDs
      for (const id of settings.admin_ids) {
        configuredAdminIds.add(id);
      }

      const spamTracker = new D1SpamTracker(env.DB);

      // ---------------------------------------------------------
      // Scenario 1: New Member Joined Group -> Send Welcome Message
      // ---------------------------------------------------------
      if (update.message?.new_chat_members && update.message.new_chat_members.length > 0) {
        if (settings.welcome_enabled) {
          const chat = update.message.chat;
          for (const newMember of update.message.new_chat_members) {
            if (newMember.is_bot) continue;

            const welcomeText = formatWelcomeMessageTS(
              settings.welcome_template,
              newMember.first_name,
              newMember.username || null,
              newMember.id,
              chat.title || env.COMMUNITY_NAME || settings.community_name,
              settings.rules_link
            );

            await client.sendMessage(chat.id, welcomeText, {
              parse_mode: 'Markdown',
              reply_to_message_id: update.message.message_id,
            });

            await recordModerationLog(
              env.DB,
              chat.id,
              newMember.id,
              newMember.username,
              'WELCOMED',
              null,
              'New member joined community',
              `Welcome message sent to ${newMember.first_name}`
            );
          }
        }
        return new Response('OK', { status: 200 });
      }

      // ---------------------------------------------------------
      // Scenario 2: Normal & Edited Message Moderation (Text + Captions) & Slash Commands
      // ---------------------------------------------------------
      const message = update.message || update.edited_message;
      if (message) {
        const rawText = message.text || '';
        const rawCaption = message.caption || '';
        const content = (rawText || rawCaption).trim();
        const user = message.from;
        const senderChat = message.sender_chat;
        const chat = message.chat;

        if (!content) {
          return new Response('OK', { status: 200 });
        }

        // Bypass for channel posting or anonymous group admins
        if (!user && senderChat && String(senderChat.id) === String(chat.id)) {
          return new Response('OK', { status: 200 });
        }

        if (!user) {
          return new Response('OK', { status: 200 });
        }

        const isAdmin = isUserAdmin(user.id, configuredAdminIds);

        // Check if message is a command (commands must be in text, not caption)
        if (rawText.startsWith('/')) {
          const commandParts = rawText.split(/\s+/);
          const command = commandParts[0].toLowerCase().split('@')[0]; // strip bot username if present
          const args = commandParts.slice(1);

          if (command === '/start' || command === '/help') {
            const statusLine = isAdmin ? '🛡️ Administrator Access Granted' : '👤 Community Member';
            const helpText =
              `⚡ *TurboNex Community Moderation Bot* ⚡\n\n` +
              `Status: ${statusLine}\n` +
              `Community: \`${env.COMMUNITY_NAME || settings.community_name}\`\n\n` +
              `*Active Defenses:*\n` +
              `• Anti-Link & Phishing: ${settings.delete_urls ? 'Active' : 'Disabled'}\n` +
              `• Phone Number Shield: ${settings.delete_phone_numbers ? 'Active' : 'Disabled'}\n` +
              `• Anti-Spam & Burst Limiter: ${settings.anti_spam_enabled ? 'Active' : 'Disabled'}\n` +
              `• Welcome Messages: ${settings.welcome_enabled ? 'Active' : 'Disabled'}\n\n` +
              (isAdmin
                ? `*Admin Commands:*\n` +
                  `/settings - View active settings\n` +
                  `/toggle_links - Toggle URL deletion\n` +
                  `/toggle_phones - Toggle phone number deletion\n` +
                  `/toggle_antispam - Toggle anti-spam limiter\n` +
                  `/schedule <delay_seconds> <text> - Queue post to linked channel\n`
                : `Community rules are strictly enforced. Links and personal numbers are deleted automatically.`);

            await client.sendMessage(chat.id, helpText, { parse_mode: 'Markdown' });
            return new Response('OK', { status: 200 });
          }

          // Admin-only commands
          if (command === '/settings') {
            if (!isAdmin) {
              await client.sendMessage(chat.id, '⛔ *Unauthorized:* Only registered admins can view or change settings.');
              return new Response('OK', { status: 200 });
            }

            const settingsText =
              `⚙️ *TurboNex Moderation Settings*\n\n` +
              `• *Bot Token:* \`${maskSecret(env.TELEGRAM_BOT_TOKEN)}\`\n` +
              `• *Admins Configured:* ${configuredAdminIds.size}\n` +
              `• *Linked Channel:* \`${env.LINKED_CHANNEL_ID || 'None'}\`\n` +
              `• *Delete URLs:* \`${settings.delete_urls}\`\n` +
              `• *Delete Phone Numbers:* \`${settings.delete_phone_numbers}\`\n` +
              `• *Anti-Spam Enabled:* \`${settings.anti_spam_enabled}\`\n` +
              `  └ Burst: ${settings.burst_limit} msgs in ${settings.burst_window_seconds}s\n` +
              `  └ Duplicates: ${settings.duplicate_limit} copies in ${settings.duplicate_window_seconds}s\n` +
              `• *Violation Action:* \`${settings.violation_action}\`\n` +
              `• *Welcome Messages:* \`${settings.welcome_enabled}\``;

            await client.sendMessage(chat.id, settingsText, { parse_mode: 'Markdown' });
            return new Response('OK', { status: 200 });
          }

          if (command === '/toggle_links') {
            if (!isAdmin) {
              await client.sendMessage(chat.id, '⛔ Unauthorized action.');
              return new Response('OK', { status: 200 });
            }
            const newVal = !settings.delete_urls;
            await updateSettingInDb(env.DB, 'delete_urls', String(newVal));
            await client.sendMessage(
              chat.id,
              `🛡️ Link deletion is now: *${newVal ? 'ENABLED (URLs will be deleted)' : 'DISABLED'}*`
            );
            return new Response('OK', { status: 200 });
          }

          if (command === '/toggle_phones') {
            if (!isAdmin) {
              await client.sendMessage(chat.id, '⛔ Unauthorized action.');
              return new Response('OK', { status: 200 });
            }
            const newVal = !settings.delete_phone_numbers;
            await updateSettingInDb(env.DB, 'delete_phone_numbers', String(newVal));
            await client.sendMessage(
              chat.id,
              `📱 Phone number protection is now: *${newVal ? 'ENABLED' : 'DISABLED'}*`
            );
            return new Response('OK', { status: 200 });
          }

          if (command === '/toggle_antispam') {
            if (!isAdmin) {
              await client.sendMessage(chat.id, '⛔ Unauthorized action.');
              return new Response('OK', { status: 200 });
            }
            const newVal = !settings.anti_spam_enabled;
            await updateSettingInDb(env.DB, 'anti_spam_enabled', String(newVal));
            await client.sendMessage(
              chat.id,
              `⏱️ Anti-spam limiter is now: *${newVal ? 'ENABLED' : 'DISABLED'}*`
            );
            return new Response('OK', { status: 200 });
          }

          if (command === '/schedule') {
            if (!isAdmin) {
              await client.sendMessage(chat.id, '⛔ Unauthorized action.');
              return new Response('OK', { status: 200 });
            }
            const channelId = env.LINKED_CHANNEL_ID;
            if (!channelId) {
              await client.sendMessage(
                chat.id,
                '⚠️ No linked channel configured. Please set `LINKED_CHANNEL_ID` in your Cloudflare Worker environment.'
              );
              return new Response('OK', { status: 200 });
            }
            if (args.length < 2) {
              await client.sendMessage(
                chat.id,
                'ℹ️ Usage: `/schedule <delay_seconds> <announcement text>`\nExample: `/schedule 3600 🚀 Big news coming!`'
              );
              return new Response('OK', { status: 200 });
            }

            const delay = parseInt(args[0], 10);
            if (isNaN(delay) || delay <= 0) {
              await client.sendMessage(chat.id, '❌ Please provide a valid positive number of seconds.');
              return new Response('OK', { status: 200 });
            }

            const content = args.slice(1).join(' ');
            const targetEpoch = Math.floor(Date.now() / 1000) + delay;
            const scheduler = new PostSchedulerD1(env.DB);
            try {
              const post = await scheduler.schedulePost(channelId, content, targetEpoch, user.id);
              await client.sendMessage(
                chat.id,
                `📅 *Post Scheduled Successfully!*\n\n` +
                  `• *Post ID:* \`${post.id}\`\n` +
                  `• *Target Channel:* \`${post.channel_id}\`\n` +
                  `• *Dispatch In:* ${delay}s\n` +
                  `• *Content:*\n_${content}_`,
                { parse_mode: 'Markdown' }
              );
            } catch (err: any) {
              await client.sendMessage(chat.id, `❌ Error scheduling post: ${err.message}`);
            }
            return new Response('OK', { status: 200 });
          }
        }

        // Rule 0: Admin bypass
        if (isAdmin) {
          return new Response('OK', { status: 200 });
        }

        // Rule 1: Anti-Spam (Burst & Duplicates on text or caption)
        if (settings.anti_spam_enabled) {
          const spamResult = await spamTracker.recordAndCheck(
            user.id,
            content,
            settings.burst_limit,
            settings.burst_window_seconds,
            settings.duplicate_limit,
            settings.duplicate_window_seconds
          );

          if (spamResult.isSpam) {
            const delRes = await client.deleteMessage(chat.id, message.message_id);
            if (!delRes.ok) {
              console.warn(`Telegram deleteMessage failed (${delRes.error_code}): ${delRes.description}`);
            }

            await recordModerationLog(
              env.DB,
              chat.id,
              user.id,
              user.username,
              delRes.ok ? 'DELETED' : 'DELETE_FAILED',
              'spam',
              spamResult.reason,
              delRes.ok ? 'Spam limit reached' : `Telegram API error: ${delRes.description || 'Permission denied'}`
            );

            if (settings.violation_action === 'delete_and_warn') {
              const handle = user.username ? `@${user.username}` : user.first_name;
              await client.sendMessage(
                chat.id,
                `⚠️ ${handle}, your message was removed: *${spamResult.reason}*.`
              );
            } else if (settings.violation_action.startsWith('mute_')) {
              const duration = settings.violation_action === 'mute_15m' ? 900 : 3600;
              const untilEpoch = Math.floor(Date.now() / 1000) + duration;
              const muteRes = await client.restrictChatMember(chat.id, user.id, untilEpoch);
              if (!muteRes.ok) {
                console.warn(`Telegram restrictChatMember failed (${muteRes.error_code}): ${muteRes.description}`);
              }
            }

            return new Response('OK', { status: 200 });
          }
        }

        // Rule 2: URL & Invite Link Detection (in text or caption)
        if (settings.delete_urls) {
          const urlCheck = containsUrl(content);
          if (urlCheck.hasUrl) {
            const delRes = await client.deleteMessage(chat.id, message.message_id);
            if (!delRes.ok) {
              console.warn(`Telegram deleteMessage failed (${delRes.error_code}): ${delRes.description}`);
            }

            await recordModerationLog(
              env.DB,
              chat.id,
              user.id,
              user.username,
              delRes.ok ? 'DELETED' : 'DELETE_FAILED',
              'url',
              'Unauthorized external link or Telegram invite',
              delRes.ok ? urlCheck.matchSnippet.slice(0, 80) : `Telegram API error: ${delRes.description || 'Permission denied'}`
            );

            if (settings.violation_action === 'delete_and_warn') {
              const handle = user.username ? `@${user.username}` : user.first_name;
              await client.sendMessage(
                chat.id,
                `⚠️ ${handle}, your message was removed: *External URLs and Telegram invite links are prohibited*.`
              );
            }
            return new Response('OK', { status: 200 });
          }
        }

        // Rule 3: Phone Number Detection (in text or caption)
        if (settings.delete_phone_numbers) {
          const phoneCheck = containsPhoneNumber(content);
          if (phoneCheck.hasPhone) {
            const delRes = await client.deleteMessage(chat.id, message.message_id);
            if (!delRes.ok) {
              console.warn(`Telegram deleteMessage failed (${delRes.error_code}): ${delRes.description}`);
            }

            await recordModerationLog(
              env.DB,
              chat.id,
              user.id,
              user.username,
              delRes.ok ? 'DELETED' : 'DELETE_FAILED',
              'phone',
              'Sharing phone numbers is strictly prohibited for member safety',
              delRes.ok ? maskPhoneNumber(phoneCheck.matchSnippet) : `Telegram API error: ${delRes.description || 'Permission denied'}`
            );

            if (settings.violation_action === 'delete_and_warn') {
              const handle = user.username ? `@${user.username}` : user.first_name;
              await client.sendMessage(
                chat.id,
                `⚠️ ${handle}, your message was removed: *Sharing phone numbers is not permitted for member safety*.`
              );
            }
            return new Response('OK', { status: 200 });
          }
        }
      }

      // Always return 200 OK so Telegram considers update handled
      return new Response('OK', { status: 200 });
    }

    // -------------------------------------------------------------
    // 2. ADMIN REST API ENDPOINTS (For Dashboard & Deployment Tools)
    // -------------------------------------------------------------

    // Health check
    if (url.pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        runtime: 'Cloudflare Workers (Edge)',
        hasBotToken: Boolean(env.TELEGRAM_BOT_TOKEN),
        maskedToken: maskSecret(env.TELEGRAM_BOT_TOKEN),
        hasSecretToken: Boolean(env.TELEGRAM_SECRET_TOKEN),
        hasDb: Boolean(env.DB),
        adminCount: parseAdminIds(env.ADMIN_IDS).size,
        communityName: env.COMMUNITY_NAME || 'TurboNex Community',
        time: new Date().toISOString(),
      });
    }

    // Verify / Inspect Telegram Webhook Status: GET /api/webhook/info (Admin Only)
    if (url.pathname === '/api/webhook/info') {
      if (!isAuthorizedAdminApi(request, env.ADMIN_API_KEY)) {
        return Response.json({ success: false, error: 'Unauthorized: Valid ADMIN_API_KEY required' }, { status: 401 });
      }
      if (!env.TELEGRAM_BOT_TOKEN) {
        return Response.json({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured in Worker' }, { status: 500 });
      }
      const client = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
      const info = await client.getWebhookInfo();
      return Response.json({
        success: info.ok,
        result: info.result,
        error: info.description,
      });
    }

    // Set Webhook Endpoint: POST /api/webhook/set (Admin Only)
    if (url.pathname === '/api/webhook/set' && request.method === 'POST') {
      if (!isAuthorizedAdminApi(request, env.ADMIN_API_KEY)) {
        return Response.json({ success: false, error: 'Unauthorized: Valid ADMIN_API_KEY required' }, { status: 401 });
      }
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_SECRET_TOKEN) {
        return Response.json(
          { success: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_SECRET_TOKEN missing' },
          { status: 500 }
        );
      }
      let targetUrl = `${url.origin}/webhook`;
      try {
        const body = (await request.json()) as any;
        if (body.webhookUrl) targetUrl = body.webhookUrl;
      } catch {
        // use default targetUrl
      }

      const client = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
      const setRes = await client.setWebhook(targetUrl, env.TELEGRAM_SECRET_TOKEN);
      return Response.json({
        success: setRes.ok,
        targetUrl,
        secretConfigured: Boolean(env.TELEGRAM_SECRET_TOKEN),
        result: setRes.result,
        error: setRes.description,
      });
    }

    // Settings API: GET & POST /api/settings (Admin Only)
    if (url.pathname === '/api/settings') {
      if (!isAuthorizedAdminApi(request, env.ADMIN_API_KEY)) {
        return Response.json({ success: false, error: 'Unauthorized: Valid ADMIN_API_KEY required' }, { status: 401 });
      }

      if (request.method === 'GET') {
        const settings = await getSettingsFromDb(env.DB);
        return Response.json({ success: true, settings });
      }

      if (request.method === 'POST') {
        try {
          const body = (await request.json()) as Partial<ModerationSettings>;
          if (env.DB) {
            for (const [k, v] of Object.entries(body)) {
              await updateSettingInDb(env.DB, k, String(v));
            }
          }
          const updated = await getSettingsFromDb(env.DB);
          return Response.json({ success: true, settings: updated });
        } catch (err: any) {
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      }
    }

    // Scheduled Posts API: GET, POST /api/scheduled-posts (Admin Only)
    if (url.pathname === '/api/scheduled-posts') {
      if (!isAuthorizedAdminApi(request, env.ADMIN_API_KEY)) {
        return Response.json({ success: false, error: 'Unauthorized: Valid ADMIN_API_KEY required' }, { status: 401 });
      }

      const scheduler = new PostSchedulerD1(env.DB);

      if (request.method === 'GET') {
        const status = url.searchParams.get('status') || undefined;
        const posts = await scheduler.listPosts(status);
        return Response.json({ success: true, posts });
      }

      if (request.method === 'POST') {
        try {
          const body = (await request.json()) as any;
          const channelId = body.channelId || env.LINKED_CHANNEL_ID;
          if (!channelId) {
            return Response.json({ success: false, error: 'Channel ID is required' }, { status: 400 });
          }
          const post = await scheduler.schedulePost(
            channelId,
            body.content,
            body.scheduledEpoch,
            body.createdBy || 0,
            body.parseMode || 'Markdown'
          );
          return Response.json({ success: true, post });
        } catch (err: any) {
          return Response.json({ success: false, error: err.message }, { status: 400 });
        }
      }
    }

    // Publish Post Immediately: POST /api/scheduled-posts/:id/publish (Admin Only)
    const publishMatch = url.pathname.match(/^\/api\/scheduled-posts\/([a-zA-Z0-9_-]+)\/publish$/);
    if (publishMatch && request.method === 'POST') {
      if (!isAuthorizedAdminApi(request, env.ADMIN_API_KEY)) {
        return Response.json({ success: false, error: 'Unauthorized: Valid ADMIN_API_KEY required' }, { status: 401 });
      }
      const postId = publishMatch[1];
      const client = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
      const scheduler = new PostSchedulerD1(env.DB);
      const res = await scheduler.publishPostNow(client, postId);
      return Response.json(res);
    }

    // Cancel Post: DELETE /api/scheduled-posts/:id (Admin Only)
    const cancelMatch = url.pathname.match(/^\/api\/scheduled-posts\/([a-zA-Z0-9_-]+)$/);
    if (cancelMatch && request.method === 'DELETE') {
      if (!isAuthorizedAdminApi(request, env.ADMIN_API_KEY)) {
        return Response.json({ success: false, error: 'Unauthorized: Valid ADMIN_API_KEY required' }, { status: 401 });
      }
      const postId = cancelMatch[1];
      const scheduler = new PostSchedulerD1(env.DB);
      const canceled = await scheduler.cancelPost(postId);
      return Response.json({ success: canceled });
    }

    // Moderation Logs: GET /api/moderation-logs (Admin Only)
    if (url.pathname === '/api/moderation-logs' && request.method === 'GET') {
      if (!isAuthorizedAdminApi(request, env.ADMIN_API_KEY)) {
        return Response.json({ success: false, error: 'Unauthorized: Valid ADMIN_API_KEY required' }, { status: 401 });
      }
      if (env.DB) {
        const logs = await env.DB.prepare('SELECT * FROM moderation_logs ORDER BY timestamp DESC LIMIT 50').all();
        return Response.json({ success: true, logs: logs.results || [] });
      }
      return Response.json({ success: true, logs: [] });
    }

    // Moderation Lab Diagnostic (Simulator/Testing): POST /api/test/moderation
    if (url.pathname === '/api/test/moderation' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { text: string; userId?: number; isAdmin?: boolean };
        const urlCheck = containsUrl(body.text);
        const phoneCheck = containsPhoneNumber(body.text);
        return Response.json({
          success: true,
          urlCheck,
          phoneCheck,
          maskedPhone: maskPhoneNumber(phoneCheck.matchSnippet),
        });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 400 });
      }
    }

    // Static Assets Fallback for Cloudflare Workers Static Assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },

  /**
   * Cloudflare Cron Trigger Handler
   * Dispatches pending due scheduled posts to Telegram channels every minute.
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.TELEGRAM_BOT_TOKEN) {
      console.warn('Cron Trigger skipped: TELEGRAM_BOT_TOKEN not configured.');
      return;
    }

    const client = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
    const scheduler = new PostSchedulerD1(env.DB);
    const now = Math.floor(Date.now() / 1000);

    try {
      const dispatched = await scheduler.processDuePosts(client, now);
      if (dispatched > 0) {
        console.log(`Cron Trigger: Dispatched ${dispatched} scheduled post(s) to linked Telegram channels.`);
      }
    } catch (err: any) {
      console.error('Error during scheduled cron execution:', err.message);
    }
  },
};
