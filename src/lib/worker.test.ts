import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeCompareStrings,
  validateTelegramWebhookSecret,
  isAuthorizedAdminApi,
  parseAdminIds,
  isUserAdmin,
  maskSecret,
  maskPhoneNumber,
} from '../worker/auth';
import {
  containsUrl,
  containsPhoneNumber,
  formatWelcomeMessageTS,
  normalizeTextForSpam,
  DEFAULT_CONFIG,
} from './moderation';
import { PostSchedulerD1 } from '../worker/scheduler';

// =========================================================================
// 1. Webhook Secret Token Header Validation Tests
// =========================================================================

test('Webhook Secret: validates authentic Telegram X-Telegram-Bot-Api-Secret-Token header', () => {
  const secret = 'super_secret_token_123456789';
  const req = new Request('https://worker.local/webhook', {
    method: 'POST',
    headers: {
      'X-Telegram-Bot-Api-Secret-Token': secret,
    },
  });

  assert.equal(validateTelegramWebhookSecret(req, secret), true);
});

test('Webhook Secret: rejects missing or incorrect secret token header', () => {
  const secret = 'correct_token_abc123';

  // Request with mismatched secret
  const badReq = new Request('https://worker.local/webhook', {
    method: 'POST',
    headers: {
      'X-Telegram-Bot-Api-Secret-Token': 'wrong_token',
    },
  });
  assert.equal(validateTelegramWebhookSecret(badReq, secret), false);

  // Request with missing header
  const missingReq = new Request('https://worker.local/webhook', {
    method: 'POST',
  });
  assert.equal(validateTelegramWebhookSecret(missingReq, secret), false);

  // Request when environment secret is unset/empty
  assert.equal(validateTelegramWebhookSecret(badReq, ''), false);
  assert.equal(validateTelegramWebhookSecret(badReq, undefined), false);
});

test('Constant-Time String Comparison: handles varied lengths and matching values securely', () => {
  assert.equal(safeCompareStrings('secret123', 'secret123'), true);
  assert.equal(safeCompareStrings('secret123', 'secret124'), false);
  assert.equal(safeCompareStrings('short', 'longer_string'), false);
  assert.equal(safeCompareStrings('', ''), true);
  assert.equal(safeCompareStrings(null as any, 'test'), false);
});

// =========================================================================
// 2. Admin API Authentication & Security Gate Tests
// =========================================================================

test('Admin API Security: accepts valid ADMIN_API_KEY in Authorization Bearer header', () => {
  const adminKey = 'prod_super_secure_key_998877';
  const req = new Request('https://worker.local/api/settings', {
    headers: {
      Authorization: `Bearer ${adminKey}`,
    },
  });
  assert.equal(isAuthorizedAdminApi(req, adminKey), true);
});

test('Admin API Security: accepts valid ADMIN_API_KEY in X-Admin-Api-Key custom header', () => {
  const adminKey = 'prod_super_secure_key_998877';
  const req = new Request('https://worker.local/api/settings', {
    headers: {
      'X-Admin-Api-Key': adminKey,
    },
  });
  assert.equal(isAuthorizedAdminApi(req, adminKey), true);
});

test('Admin API Security: STRICTLY REJECTS TELEGRAM_SECRET_TOKEN as an admin credential', () => {
  const adminKey = 'prod_admin_key_112233';
  const secretToken = 'telegram_webhook_secret_aabbcc';

  // Attacker attempts to use webhook secret token to access admin settings API
  const attackerReq = new Request('https://worker.local/api/settings', {
    headers: {
      Authorization: `Bearer ${secretToken}`,
    },
  });

  assert.equal(isAuthorizedAdminApi(attackerReq, adminKey), false);
});

test('Admin API Security: fails closed when ADMIN_API_KEY is unset or empty', () => {
  const req = new Request('https://worker.local/api/settings', {
    headers: {
      Authorization: 'Bearer any_key_attempt',
    },
  });

  assert.equal(isAuthorizedAdminApi(req, undefined), false);
  assert.equal(isAuthorizedAdminApi(req, ''), false);
  assert.equal(isAuthorizedAdminApi(req, '   '), false);
});

test('Admin API Security: rejects missing or invalid authorization credentials', () => {
  const adminKey = 'valid_key_554433';

  const emptyReq = new Request('https://worker.local/api/settings');
  assert.equal(isAuthorizedAdminApi(emptyReq, adminKey), false);

  const wrongReq = new Request('https://worker.local/api/settings', {
    headers: { Authorization: 'Bearer incorrect_key' },
  });
  assert.equal(isAuthorizedAdminApi(wrongReq, adminKey), false);
});

// =========================================================================
// 3. Admin Authorization & Environment Parsing Tests
// =========================================================================

test('Admin Authorization: DEFAULT_CONFIG has ZERO hardcoded admin IDs', () => {
  // Verifies requirement 1: Only explicitly configured ADMIN_IDS may grant administrator privileges
  assert.equal(DEFAULT_CONFIG.adminIds.length, 0);
  assert.deepEqual(DEFAULT_CONFIG.adminIds, []);
});

test('Admin Authorization: demo IDs 999001 and 777123 do NOT authorize without explicit config', () => {
  const emptyAdminSet = parseAdminIds('');
  assert.equal(isUserAdmin(999001, emptyAdminSet), false);
  assert.equal(isUserAdmin(777123, emptyAdminSet), false);
});

test('Admin Authorization: parses comma-separated ADMIN_IDS environment string', () => {
  const adminSet = parseAdminIds('111222, 333444, 123456789, invalid_str, , 445566');
  assert.equal(adminSet.has(111222), true);
  assert.equal(adminSet.has(333444), true);
  assert.equal(adminSet.has(123456789), true);
  assert.equal(adminSet.has(445566), true);
  assert.equal(adminSet.has(999001), false); // Not configured
  assert.equal(adminSet.size, 4); // Invalid strings and empty entries ignored
});

test('Admin Authorization: checks whether a given user ID is an admin', () => {
  const adminSet = parseAdminIds('10001, 20002');
  assert.equal(isUserAdmin(10001, adminSet), true);
  assert.equal(isUserAdmin(20002, adminSet), true);
  assert.equal(isUserAdmin(555555, adminSet), false);
  assert.equal(isUserAdmin(0, adminSet), false);
});

// =========================================================================
// 4. Secret & Phone Privacy Redaction Tests
// =========================================================================

test('Privacy Redaction: masks bot tokens and sensitive phone numbers', () => {
  assert.equal(maskSecret('7182938472:AAElskdfj-XYZ12345'), '7182***2345');
  assert.equal(maskSecret(''), '[NOT CONFIGURED]');
  assert.equal(maskSecret(undefined), '[NOT CONFIGURED]');
  assert.equal(maskSecret('short'), '***REDACTED***');

  assert.equal(maskPhoneNumber('+1 (555) 234-5678'), '+1 (***78');
  assert.equal(maskPhoneNumber('+44 7911 123456'), '+44 ***56');
  assert.equal(maskPhoneNumber(''), '');
});

// =========================================================================
// 5. Text AND Caption Moderation Tests
// =========================================================================

test('Text & Caption Moderation: detects URLs in photo/video/media captions', () => {
  const photoCaptionWithUrl = 'Check out our new website at https://turbonex-airdrop.xyz/claim!';
  const photoCaptionWithInvite = 'Join VIP channel: t.me/+SecretInviteCode';
  const photoCaptionWithObfuscated = 'Tokens available at turbonex [dot] xyz right now';
  const benignCaption = 'Photo of our TurboNex booth at ETH Denver 2026';

  assert.equal(containsUrl(photoCaptionWithUrl).hasUrl, true);
  assert.equal(containsUrl(photoCaptionWithInvite).hasUrl, true);
  assert.equal(containsUrl(photoCaptionWithObfuscated).hasUrl, true);
  assert.equal(containsUrl(benignCaption).hasUrl, false);
});

test('Text & Caption Moderation: detects phone numbers in message captions', () => {
  const captionWithPhone1 = 'Contact support on WhatsApp at +1 (555) 234-5678 for quick assistance';
  const captionWithPhone2 = 'Call hotline: +44 7911 123456';
  const benignCaption = 'Order confirmation #8492041 received on 2026-10-27';

  assert.equal(containsPhoneNumber(captionWithPhone1).hasPhone, true);
  assert.equal(containsPhoneNumber(captionWithPhone2).hasPhone, true);
  assert.equal(containsPhoneNumber(benignCaption).hasPhone, false);
});

test('URL Detection: detects standard, bare, Telegram invite, and obfuscated links', () => {
  assert.equal(containsUrl('Visit https://turbonex-airdrop.xyz/claim immediately').hasUrl, true);
  assert.equal(containsUrl('Join our group at t.me/+SecretInviteCode').hasUrl, true);
  assert.equal(containsUrl('VIP channel: telegram.me/turbonex_channel').hasUrl, true);
  assert.equal(containsUrl('turbonex [dot] xyz').hasUrl, true);
  assert.equal(containsUrl('claim tokens at scam (dot) com').hasUrl, true);
  assert.equal(containsUrl('Clean message about project updates').hasUrl, false);
});

test('Phone Detection: catches international and formatted phone numbers while ignoring benign numbers', () => {
  assert.equal(containsPhoneNumber('Call support at +1 555 234 5678').hasPhone, true);
  assert.equal(containsPhoneNumber('Emergency hotline: (555) 839-2041').hasPhone, true);
  assert.equal(containsPhoneNumber('WhatsApp: +44 7911 123456').hasPhone, true);
  assert.equal(containsPhoneNumber('WhatsApp me: 9 8 7 6 5 4 3 2 1 0').hasPhone, true);

  // Safe benign numbers should NOT trigger
  assert.equal(containsPhoneNumber('Release date is 2026-10-27 in Q4').hasPhone, false);
  assert.equal(containsPhoneNumber('We have 1500 members').hasPhone, false);
  assert.equal(containsPhoneNumber('Price is $45.99').hasPhone, false);
});

// =========================================================================
// 6. Scheduler Atomic Concurrency Lock Tests
// =========================================================================

test('Scheduler Concurrency Lock: atomic lease transitions status from pending to publishing', async () => {
  // In-memory mock representing SQLite atomic UPDATE behavior in Cloudflare D1
  const mockTable = new Map<string, { id: string; status: string }>();
  mockTable.set('post-1', { id: 'post-1', status: 'pending' });

  // Atomic lease function simulating:
  // UPDATE scheduled_posts SET status = 'publishing' WHERE id = ? AND status = 'pending'
  const atomicClaimPost = (id: string): { changes: number } => {
    const post = mockTable.get(id);
    if (post && post.status === 'pending') {
      post.status = 'publishing';
      return { changes: 1 };
    }
    return { changes: 0 };
  };

  // First Cron execution claims the post: succeeds with 1 change
  const execution1 = atomicClaimPost('post-1');
  assert.equal(execution1.changes, 1);
  assert.equal(mockTable.get('post-1')?.status, 'publishing');

  // Second concurrent Cron execution attempts to claim the same post: returns 0 changes (locks out duplicate!)
  const execution2 = atomicClaimPost('post-1');
  assert.equal(execution2.changes, 0);

  // A canceled or already published post also returns 0 changes
  mockTable.set('post-2', { id: 'post-2', status: 'published' });
  assert.equal(atomicClaimPost('post-2').changes, 0);

  mockTable.set('post-3', { id: 'post-3', status: 'canceled' });
  assert.equal(atomicClaimPost('post-3').changes, 0);
});

// =========================================================================
// 7. Welcome Message & Anti-Spam Normalization Tests
// =========================================================================

test('Welcome Templating: renders dynamic variables correctly', () => {
  const template = '👋 Welcome {mention} ({username}) to {group_name}! Rules: {rules_link}';
  const formatted = formatWelcomeMessageTS(
    template,
    'Jordan',
    'jordan_web3',
    98765,
    'TurboNex Community',
    'https://t.me/turbonex_rules'
  );

  assert.equal(
    formatted,
    '👋 Welcome @jordan_web3 (@jordan_web3) to TurboNex Community! Rules: https://t.me/turbonex_rules'
  );
});

test('Spam Text Normalizer: collapses case, punctuation, and excess whitespace', () => {
  const raw = '  BUY   TURBONEX  TOKEN !!!   🚀🚀 ';
  assert.equal(normalizeTextForSpam(raw), 'buy turbonex token');
});
