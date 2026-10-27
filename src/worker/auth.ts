/**
 * Security & Authorization Helper for Cloudflare Workers
 * Enforces constant-time webhook secret validation and admin verification.
 */

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 */
export function safeCompareStrings(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Validates the incoming Telegram Webhook secret token header:
 * 'X-Telegram-Bot-Api-Secret-Token'
 */
export function validateTelegramWebhookSecret(
  request: Request,
  expectedSecret: string | undefined
): boolean {
  if (!expectedSecret || expectedSecret.trim() === '') {
    // If no secret is configured, reject to fail closed
    return false;
  }
  const incomingHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return safeCompareStrings(incomingHeader, expectedSecret.trim());
}

/**
 * Validates administrative API requests using ADMIN_API_KEY.
 * CRITICAL SECURITY REQUIREMENT:
 * Never accepts TELEGRAM_SECRET_TOKEN or any fallback token.
 * Fails closed if ADMIN_API_KEY is unset or empty.
 */
export function isAuthorizedAdminApi(
  request: Request | { headers: any },
  expectedAdminApiKey: string | undefined
): boolean {
  if (!expectedAdminApiKey || expectedAdminApiKey.trim() === '') {
    // Fail closed: without an explicitly configured ADMIN_API_KEY, admin APIs cannot be accessed
    return false;
  }

  let authHeader = '';
  let customHeader = '';

  if (typeof (request as Request).headers?.get === 'function') {
    authHeader = (request as Request).headers.get('Authorization') || '';
    customHeader = (request as Request).headers.get('X-Admin-Api-Key') || '';
  } else if ((request as any).headers) {
    const rawAuth = (request as any).headers['authorization'] || (request as any).headers['Authorization'];
    const rawKey = (request as any).headers['x-admin-api-key'] || (request as any).headers['X-Admin-Api-Key'];
    authHeader = typeof rawAuth === 'string' ? rawAuth : '';
    customHeader = typeof rawKey === 'string' ? rawKey : '';
  }

  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const token = bearerToken || customHeader.trim();

  if (!token) {
    return false;
  }

  return safeCompareStrings(token, expectedAdminApiKey.trim());
}

/**
 * Parses configured admin IDs from environment variable (comma-separated numeric IDs).
 */
export function parseAdminIds(adminIdsStr?: string): Set<number> {
  const result = new Set<number>();
  if (!adminIdsStr) return result;
  const parts = adminIdsStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (/^\d+$/.test(trimmed)) {
      result.add(parseInt(trimmed, 10));
    }
  }
  return result;
}

/**
 * Checks if a Telegram user is in the configured admin set.
 */
export function isUserAdmin(userId: number, adminIds: Set<number>): boolean {
  return adminIds.has(userId);
}

/**
 * Safely masks secret tokens for logs (e.g. '7182938472:AAElskdfj-XYZ12345' -> '7182***2345').
 */
export function maskSecret(secret?: string): string {
  if (!secret) return '[NOT CONFIGURED]';
  const clean = secret.trim();
  if (clean.length <= 8) return '***REDACTED***';
  return `${clean.slice(0, 4)}***${clean.slice(-4)}`;
}

/**
 * Safely masks a phone number for audit logs (e.g. '+1 (555) 234-5678' -> '+1 5***78').
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
