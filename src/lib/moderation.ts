/**
 * TurboNex Community Moderation Rules & Detection Engine (TypeScript Edition)
 * Mirrors the Python bot logic for deterministic in-browser simulation,
 * interactive rule testing, and unit testing.
 */

export interface ModerationConfig {
  deleteUrls: boolean;
  deleteInvites: boolean;
  deletePhoneNumbers: boolean;
  antiSpamEnabled: boolean;
  burstLimit: number;
  burstWindowSeconds: number;
  duplicateLimit: number;
  duplicateWindowSeconds: number;
  violationAction: 'delete_only' | 'delete_and_warn' | 'mute_15m' | 'mute_1h';
  welcomeEnabled: boolean;
  welcomeTemplate: string;
  rulesLink: string;
  communityName: string;
  adminIds: number[];
}

export const DEFAULT_CONFIG: ModerationConfig = {
  deleteUrls: true,
  deleteInvites: true,
  deletePhoneNumbers: true,
  antiSpamEnabled: true,
  burstLimit: 5,
  burstWindowSeconds: 8,
  duplicateLimit: 3,
  duplicateWindowSeconds: 30,
  violationAction: 'delete_and_warn',
  welcomeEnabled: true,
  welcomeTemplate: '👋 Welcome {mention} to {group_name}!\n\n⚡ Enjoy your stay!\n📜 Community Rules: {rules_link}\n🚫 No spam, links, or phone numbers allowed from regular members.',
  rulesLink: 'https://t.me/turbonex_rules',
  communityName: 'TurboNex Community',
  adminIds: [999001, 777123],
};

const COMMON_TLDS = [
  'com', 'net', 'org', 'io', 'xyz', 'co', 'me', 'top', 'biz', 'info',
  'cc', 'online', 'site', 'app', 'dev', 'link', 'vip', 'pro', 'shop',
  'buzz', 'live', 'icu', 'ru', 'cn', 'in', 'gg', 'tech', 'club', 'space',
  'fun', 'agency', 'finance', 'cash', 'crypt', 'token', 'exchange',
  'market', 'store', 'website', 'cloud'
].join('|');

const REGEX_HTTP_URL = /(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*/i;
const REGEX_BARE_DOMAIN = new RegExp(`\\b(?:[a-zA-Z0-9-]+\\.)+(?:${COMMON_TLDS})\\b(?:/[^\\s]*)?`, 'i');
const REGEX_TELEGRAM_INVITE = /(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.(?:me|dog)\/(?:joinchat\/|\+[a-zA-Z0-9_-]+|[a-zA-Z0-9_]{4,})/i;
const REGEX_OBFUSCATED_DOT = new RegExp(`\\b[a-zA-Z0-9_-]+(?:\\s*(?:\\[dot\\]|\\(dot\\)|\\bdot\\b|\\.)\\s*[a-zA-Z0-9_-]+)*\\s*(?:\\[dot\\]|\\(dot\\)|\\bdot\\b|\\.)\\s*(?:${COMMON_TLDS})\\b`, 'i');

const REGEX_INTERNATIONAL_PHONE = /(?:\+|00)\s*[1-9]\d{0,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}/g;
const REGEX_FORMATTED_PHONE = /(?<!\w)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/g;
const REGEX_SPACED_PHONE = /(?<!\w)(?:\+\s*1\s*)?(?:\d\s*[-.\s]\s*){9,14}\d(?!\w)/g;
const REGEX_PHONE_KEYWORDS = /\b(?:call|phone|whatsapp|tel|text|contact)\s*(?:me|us|at|on)?\s*[:\s]*([+\d\s().-]{7,25})/i;

export function containsUrl(text: string): { hasUrl: boolean; matchSnippet: string } {
  if (!text) return { hasUrl: false, matchSnippet: '' };

  const tgMatch = text.match(REGEX_TELEGRAM_INVITE);
  if (tgMatch) return { hasUrl: true, matchSnippet: `Telegram invite/link: ${tgMatch[0]}` };

  const httpMatch = text.match(REGEX_HTTP_URL);
  if (httpMatch) return { hasUrl: true, matchSnippet: `URL: ${httpMatch[0]}` };

  const domainMatch = text.match(REGEX_BARE_DOMAIN);
  if (domainMatch) return { hasUrl: true, matchSnippet: `Domain link: ${domainMatch[0]}` };

  const obfMatch = text.match(REGEX_OBFUSCATED_DOT);
  if (obfMatch) return { hasUrl: true, matchSnippet: `Obfuscated link: ${obfMatch[0]}` };

  return { hasUrl: false, matchSnippet: '' };
}

export function isSafeNumber(snippet: string): boolean {
  const digits = snippet.replace(/\D/g, '');
  if (digits.length < 7) return true;
  if (digits.length === 7 && !/[()\-+ ]/.test(snippet)) return true;
  if (digits.length < 10 && !snippet.trim().startsWith('+') && !snippet.includes('(')) return true;
  return false;
}

export function containsPhoneNumber(text: string): { hasPhone: boolean; matchSnippet: string } {
  if (!text) return { hasPhone: false, matchSnippet: '' };

  const kwMatch = text.match(REGEX_PHONE_KEYWORDS);
  if (kwMatch) {
    const rawDigits = kwMatch[1].replace(/\D/g, '');
    if (rawDigits.length >= 7) {
      return { hasPhone: true, matchSnippet: `Phone with keyword: ${kwMatch[1].trim()}` };
    }
  }

  const intlMatches = Array.from(text.matchAll(REGEX_INTERNATIONAL_PHONE));
  for (const m of intlMatches) {
    if (!isSafeNumber(m[0])) {
      return { hasPhone: true, matchSnippet: m[0].trim() };
    }
  }

  const fmtMatches = Array.from(text.matchAll(REGEX_FORMATTED_PHONE));
  for (const m of fmtMatches) {
    if (!isSafeNumber(m[0])) {
      return { hasPhone: true, matchSnippet: m[0].trim() };
    }
  }

  const spacedMatch = text.match(REGEX_SPACED_PHONE);
  if (spacedMatch) {
    const digits = spacedMatch[0].replace(/\D/g, '');
    if (digits.length >= 10) {
      return { hasPhone: true, matchSnippet: `Spaced phone: ${spacedMatch[0].trim()}` };
    }
  }

  return { hasPhone: false, matchSnippet: '' };
}

export function normalizeTextForSpam(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export class SpamTrackerTS {
  private userTimestamps = new Map<number, number[]>();
  private userMessages = new Map<number, Array<{ text: string; time: number }>>();

  constructor(
    public burstLimit = 5,
    public burstWindowSeconds = 8,
    public duplicateLimit = 3,
    public duplicateWindowSeconds = 30
  ) {}

  recordAndCheck(userId: number, text: string, now: number = Date.now() / 1000): { isSpam: boolean; reason: string } {
    // 1. Burst rate
    let timestamps = this.userTimestamps.get(userId) || [];
    timestamps = timestamps.filter(t => (now - t) <= this.burstWindowSeconds);
    timestamps.push(now);
    this.userTimestamps.set(userId, timestamps);

    if (timestamps.length > this.burstLimit) {
      return {
        isSpam: true,
        reason: `Excessive posting rate (${timestamps.length} messages in under ${this.burstWindowSeconds}s)`
      };
    }

    // 2. Duplicate detection
    const norm = normalizeTextForSpam(text);
    if (norm.length >= 4) {
      let msgs = this.userMessages.get(userId) || [];
      msgs = msgs.filter(m => (now - m.time) <= this.duplicateWindowSeconds);
      msgs.push({ text: norm, time: now });
      this.userMessages.set(userId, msgs);

      const dupeCount = msgs.filter(m => m.text === norm).length;
      if (dupeCount >= this.duplicateLimit) {
        return {
          isSpam: true,
          reason: `Repeated message detected (${dupeCount} identical messages within ${this.duplicateWindowSeconds}s)`
        };
      }
    }

    return { isSpam: false, reason: '' };
  }

  reset(userId?: number) {
    if (userId) {
      this.userTimestamps.delete(userId);
      this.userMessages.delete(userId);
    } else {
      this.userTimestamps.clear();
      this.userMessages.clear();
    }
  }
}

export interface ModerationDecisionTS {
  shouldDelete: boolean;
  violationType?: 'url' | 'phone' | 'spam';
  reason: string;
  matchedDetail: string;
  penaltyAction: string;
}

export function evaluateMessageTS(
  text: string,
  userId: number,
  isAdmin: boolean,
  config: ModerationConfig,
  spamTracker?: SpamTrackerTS,
  now: number = Date.now() / 1000
): ModerationDecisionTS {
  if (isAdmin) {
    return {
      shouldDelete: false,
      reason: 'Admin authorized - bypass active',
      matchedDetail: '',
      penaltyAction: 'none'
    };
  }

  if (config.antiSpamEnabled && spamTracker) {
    const { isSpam, reason } = spamTracker.recordAndCheck(userId, text, now);
    if (isSpam) {
      return {
        shouldDelete: true,
        violationType: 'spam',
        reason,
        matchedDetail: 'Spam rate exceeded',
        penaltyAction: config.violationAction
      };
    }
  }

  if (config.deleteUrls) {
    const { hasUrl, matchSnippet } = containsUrl(text);
    if (hasUrl) {
      return {
        shouldDelete: true,
        violationType: 'url',
        reason: 'Unauthorized external link or Telegram invite',
        matchedDetail: matchSnippet,
        penaltyAction: config.violationAction
      };
    }
  }

  if (config.deletePhoneNumbers) {
    const { hasPhone, matchSnippet } = containsPhoneNumber(text);
    if (hasPhone) {
      return {
        shouldDelete: true,
        violationType: 'phone',
        reason: 'Sharing phone numbers is strictly prohibited for member safety',
        matchedDetail: matchSnippet,
        penaltyAction: config.violationAction
      };
    }
  }

  return {
    shouldDelete: false,
    reason: 'Message complies with community rules',
    matchedDetail: '',
    penaltyAction: 'none'
  };
}

export function maskSecretTS(secret: string): string {
  if (!secret) return '[NOT SET]';
  const clean = secret.trim();
  if (clean.length <= 8) return '***REDACTED***';
  return `${clean.slice(0, 4)}***${clean.slice(-4)}`;
}

export function maskPhoneNumberTS(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}

export function formatWelcomeMessageTS(
  template: string,
  firstName: string,
  username: string | null,
  userId: number,
  groupName: string,
  rulesLink: string
): string {
  const mention = username ? `@${username}` : `[${firstName}](tg://user?id=${userId})`;
  const userHandle = username ? `@${username}` : firstName;

  return template
    .replace(/{mention}/g, mention)
    .replace(/{username}/g, userHandle)
    .replace(/{user_id}/g, String(userId))
    .replace(/{group_name}/g, groupName)
    .replace(/{rules_link}/g, rulesLink);
}
