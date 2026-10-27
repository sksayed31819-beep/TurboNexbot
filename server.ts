import express from 'express';
import { createServer as createViteServer } from 'vite';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  containsPhoneNumber,
  containsUrl,
  formatWelcomeMessageTS,
  DEFAULT_CONFIG,
  ModerationConfig,
} from './src/lib/moderation';
import {
  safeCompareStrings,
  validateTelegramWebhookSecret,
  isAuthorizedAdminApi,
  parseAdminIds,
  isUserAdmin,
  maskSecret,
  maskPhoneNumber,
} from './src/worker/auth';
import { TelegramClient } from './src/worker/telegram';

dotenv.config();

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory persistent stores for local server / development
let localSettings: ModerationConfig = { ...DEFAULT_CONFIG };

interface ScheduledPostServer {
  id: string;
  channelId: string;
  content: string;
  scheduledEpoch: number;
  createdBy: number;
  parseMode: string;
  status: 'pending' | 'publishing' | 'published' | 'failed' | 'canceled';
  errorMessage?: string | null;
  createdAt: number;
  publishedAt?: number | null;
}

let localScheduledPosts: ScheduledPostServer[] = [
  {
    id: 'post-101',
    channelId: process.env.LINKED_CHANNEL_ID || '@turbonex_official',
    content:
      '🔥 **Weekly Community AMA Announcement**\nJoin us this Thursday at 3 PM UTC for live Q&A with the TurboNex core engineering team!\n\nSet your reminder now.',
    scheduledEpoch: Math.floor(Date.now() / 1000) + 3600,
    createdBy: 0,
    parseMode: 'Markdown',
    status: 'pending',
    createdAt: Math.floor(Date.now() / 1000) - 1800,
  },
  {
    id: 'post-100',
    channelId: process.env.LINKED_CHANNEL_ID || '@turbonex_official',
    content: '⚡ Welcome new members! Please ensure you only follow official TurboNex verified accounts.',
    scheduledEpoch: Math.floor(Date.now() / 1000) - 3600,
    createdBy: 0,
    parseMode: 'Markdown',
    status: 'published',
    createdAt: Math.floor(Date.now() / 1000) - 7200,
    publishedAt: Math.floor(Date.now() / 1000) - 3600,
  },
];

interface ModerationLogEntry {
  id: string;
  timestamp: number;
  chatId: string;
  userId: number;
  userHandle?: string;
  action: 'DELETED' | 'WARNED' | 'MUTED' | 'WELCOMED' | 'ALLOWED' | 'DELETE_FAILED';
  violationType?: 'url' | 'phone' | 'spam';
  reason: string;
  sanitizedDetail?: string;
}

let localModerationLogs: ModerationLogEntry[] = [
  {
    id: 'log-0',
    timestamp: Math.floor(Date.now() / 1000) - 60,
    chatId: '-1001234567890',
    userId: 0,
    userHandle: 'turbonex_bot',
    action: 'ALLOWED',
    reason: 'Initial system boot check',
    sanitizedDetail: 'System defense operational',
  },
];

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Helper for Telegram client
  const getTelegramClient = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token.trim() === '') return null;
    return new TelegramClient(token);
  };

  // -------------------------------------------------------------
  // API: Health & Status Check
  // -------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const secret = process.env.TELEGRAM_SECRET_TOKEN;
    const adminIds = parseAdminIds(process.env.ADMIN_IDS);

    return res.json({
      status: 'ok',
      runtime: 'Cloudflare Workers (Edge Compatible Engine)',
      hasBotToken: Boolean(token),
      maskedToken: maskSecret(token),
      hasSecretToken: Boolean(secret),
      hasAdminKey: Boolean(process.env.ADMIN_API_KEY),
      adminCount: adminIds.size,
      communityGroup: process.env.COMMUNITY_GROUP_ID || null,
      linkedChannel: process.env.LINKED_CHANNEL_ID || null,
      time: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------
  // API: Run Automated TypeScript & Worker Unit Tests
  // -------------------------------------------------------------
  app.post('/api/run-unit-tests', async (_req, res) => {
    try {
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(
        'npx --yes tsx --test src/lib/worker.test.ts src/lib/moderation.test.ts',
        { cwd: __dirname, timeout: 15000 }
      );
      const durationMs = Date.now() - startTime;
      return res.json({
        success: true,
        output: (stdout + '\n' + stderr).trim(),
        durationMs,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message,
        output: (err.stdout + '\n' + err.stderr).trim(),
      });
    }
  });

  // Authentication middleware for administrative APIs
  const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const adminKey = process.env.ADMIN_API_KEY;
    if (!isAuthorizedAdminApi(req, adminKey)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Valid ADMIN_API_KEY required. TELEGRAM_SECRET_TOKEN is not an administrative credential.',
      });
    }
    next();
  };

  // -------------------------------------------------------------
  // API: Inspect Real Telegram Webhook Status via getWebhookInfo
  // -------------------------------------------------------------
  app.get('/api/webhook/info', requireAdminAuth, async (_req, res) => {
    const client = getTelegramClient();
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_BOT_TOKEN is not configured in environment secrets.',
      });
    }

    const info = await client.getWebhookInfo();
    return res.json({
      success: info.ok,
      result: info.result,
      error: info.description,
    });
  });

  // -------------------------------------------------------------
  // API: Set Telegram Webhook securely via setWebhook
  // -------------------------------------------------------------
  app.post('/api/webhook/set', requireAdminAuth, async (req, res) => {
    const client = getTelegramClient();
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_BOT_TOKEN is not configured in environment secrets.',
      });
    }

    const secretToken = process.env.TELEGRAM_SECRET_TOKEN || req.body.secretToken;
    if (!secretToken) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_SECRET_TOKEN is required to register webhook securely.',
      });
    }

    const webhookUrl = req.body.webhookUrl;
    if (!webhookUrl || !webhookUrl.startsWith('https://')) {
      return res.status(400).json({
        success: false,
        error: 'Webhook URL must start with https:// (Telegram requires valid HTTPS endpoint).',
      });
    }

    const setRes = await client.setWebhook(webhookUrl, secretToken);
    return res.json({
      success: setRes.ok,
      targetUrl: webhookUrl,
      result: setRes.result,
      error: setRes.description,
    });
  });

  // -------------------------------------------------------------
  // API: Settings Management (GET & POST)
  // -------------------------------------------------------------
  app.get('/api/settings', requireAdminAuth, (_req, res) => {
    return res.json({ success: true, settings: localSettings });
  });

  app.post('/api/settings', requireAdminAuth, (req, res) => {
    const updates = req.body;
    localSettings = { ...localSettings, ...updates };
    return res.json({ success: true, settings: localSettings });
  });

  // -------------------------------------------------------------
  // API: Scheduled Posts Management
  // -------------------------------------------------------------
  app.get('/api/scheduled-posts', requireAdminAuth, (req, res) => {
    const status = req.query.status as string;
    let posts = localScheduledPosts;
    if (status) {
      posts = posts.filter((p) => p.status === status);
    }
    // Sort descending by scheduledEpoch
    posts.sort((a, b) => b.scheduledEpoch - a.scheduledEpoch);
    return res.json({ success: true, posts });
  });

  app.post('/api/scheduled-posts', requireAdminAuth, (req, res) => {
    const { channelId, content, scheduledEpoch, createdBy, parseMode } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Post content cannot be empty.' });
    }
    const targetChannel = channelId || process.env.LINKED_CHANNEL_ID || '@turbonex_official';
    const now = Math.floor(Date.now() / 1000);

    if (scheduledEpoch && scheduledEpoch < now - 60) {
      return res.status(400).json({ success: false, error: 'Scheduled time cannot be in the past.' });
    }

    const newPost: ScheduledPostServer = {
      id: `post-${Math.floor(1000 + Math.random() * 9000)}`,
      channelId: targetChannel,
      content: content.trim(),
      scheduledEpoch: scheduledEpoch || now + 3600,
      createdBy: createdBy || 0,
      parseMode: parseMode || 'Markdown',
      status: 'pending',
      createdAt: now,
    };

    localScheduledPosts.unshift(newPost);
    return res.json({ success: true, post: newPost });
  });

  app.post('/api/scheduled-posts/:id/publish', requireAdminAuth, async (req, res) => {
    const post = localScheduledPosts.find((p) => p.id === req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found.' });
    }

    const client = getTelegramClient();
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_BOT_TOKEN not configured. Live dispatch requires a real bot token in environment secrets.',
      });
    }

    const sendRes = await client.sendMessage(post.channelId, post.content, {
      parse_mode: post.parseMode as any,
    });

    if (sendRes.ok) {
      post.status = 'published';
      post.publishedAt = Math.floor(Date.now() / 1000);
      post.errorMessage = null;
      return res.json({ success: true, result: sendRes.result });
    } else {
      post.status = 'failed';
      post.errorMessage = sendRes.description;
      return res.status(400).json({ success: false, error: sendRes.description });
    }
  });

  app.delete('/api/scheduled-posts/:id', requireAdminAuth, (req, res) => {
    const post = localScheduledPosts.find((p) => p.id === req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found.' });
    }
    post.status = 'canceled';
    return res.json({ success: true });
  });

  // -------------------------------------------------------------
  // API: Moderation Logs (Admin Only)
  // -------------------------------------------------------------
  app.get('/api/moderation-logs', requireAdminAuth, (_req, res) => {
    return res.json({ success: true, logs: localModerationLogs });
  });

  app.post('/api/moderation-logs', requireAdminAuth, (req, res) => {
    const entry: ModerationLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      chatId: req.body.chatId || '-1001234567890',
      userId: req.body.userId || 0,
      userHandle: req.body.userHandle,
      action: req.body.action || 'DELETED',
      violationType: req.body.violationType,
      reason: req.body.reason || '',
      sanitizedDetail: req.body.sanitizedDetail || '',
    };
    localModerationLogs.unshift(entry);
    if (localModerationLogs.length > 50) localModerationLogs.pop();
    return res.json({ success: true, log: entry });
  });

  // -------------------------------------------------------------
  // API: Real Webhook Endpoint (For testing or tunneling)
  // -------------------------------------------------------------
  app.post('/webhook', async (req, res) => {
    const expectedSecret = process.env.TELEGRAM_SECRET_TOKEN;
    const incomingHeader = req.headers['x-telegram-bot-api-secret-token'] as string;

    if (expectedSecret && !safeCompareStrings(incomingHeader, expectedSecret)) {
      return res.status(401).send('Unauthorized webhook: Invalid X-Telegram-Bot-Api-Secret-Token');
    }

    const update = req.body;
    const client = getTelegramClient();
    const message = update.message || update.edited_message;

    if (client && message) {
      const content = (message.text || message.caption || '').trim();
      const chatId = message.chat.id;
      const messageId = message.message_id;
      const userId = message.from?.id;

      const adminIds = parseAdminIds(process.env.ADMIN_IDS);
      const isAdmin = userId ? isUserAdmin(userId, adminIds) : false;

      if (!isAdmin && content) {
        const urlCheck = containsUrl(content);
        if (urlCheck.hasUrl && localSettings.deleteUrls) {
          const delRes = await client.deleteMessage(chatId, messageId);
          localModerationLogs.unshift({
            id: `log-${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000),
            chatId: String(chatId),
            userId: userId || 0,
            userHandle: message.from?.username,
            action: delRes.ok ? 'DELETED' : 'DELETE_FAILED',
            violationType: 'url',
            reason: 'Unauthorized external link or Telegram invite',
            sanitizedDetail: delRes.ok ? urlCheck.matchSnippet.slice(0, 80) : `Telegram error: ${delRes.description}`,
          });
        }

        const phoneCheck = containsPhoneNumber(content);
        if (phoneCheck.hasPhone && localSettings.deletePhoneNumbers) {
          const delRes = await client.deleteMessage(chatId, messageId);
          localModerationLogs.unshift({
            id: `log-${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000),
            chatId: String(chatId),
            userId: userId || 0,
            userHandle: message.from?.username,
            action: delRes.ok ? 'DELETED' : 'DELETE_FAILED',
            violationType: 'phone',
            reason: 'Sharing phone numbers is strictly prohibited',
            sanitizedDetail: delRes.ok ? maskPhoneNumber(phoneCheck.matchSnippet) : `Telegram error: ${delRes.description}`,
          });
        }
      }
    }

    return res.status(200).send('OK');
  });

  // -------------------------------------------------------------
  // API: Cloudflare Worker Source Files Explorer
  // -------------------------------------------------------------
  app.get('/api/worker-files', (_req, res) => {
    try {
      const fileList = [
        { name: 'wrangler.toml', path: 'wrangler.toml' },
        { name: '0001_init.sql', path: 'migrations/0001_init.sql' },
        { name: 'index.ts', path: 'src/worker/index.ts' },
        { name: 'telegram.ts', path: 'src/worker/telegram.ts' },
        { name: 'scheduler.ts', path: 'src/worker/scheduler.ts' },
        { name: 'spam.ts', path: 'src/worker/spam.ts' },
        { name: 'auth.ts', path: 'src/worker/auth.ts' },
        { name: 'types.ts', path: 'src/worker/types.ts' },
        { name: 'worker.test.ts', path: 'src/lib/worker.test.ts' },
      ];

      const files = fileList.map((item) => {
        const fullPath = path.join(__dirname, item.path);
        let content = '';
        if (fs.existsSync(fullPath)) {
          content = fs.readFileSync(fullPath, 'utf-8');
        }
        return {
          name: item.name,
          path: item.path,
          content,
          size: Buffer.byteLength(content, 'utf-8'),
        };
      });

      return res.json({ success: true, files });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Mount Vite or serve static dist
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TurboNex Bot Control Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
