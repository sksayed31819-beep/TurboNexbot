/**
 * TurboNex Cloudflare Worker Types & Telegram Bot API Interfaces
 */

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_SECRET_TOKEN: string;
  ADMIN_IDS?: string; // Comma-separated list of numeric Telegram User IDs
  COMMUNITY_GROUP_ID?: string; // Optional target community group ID (e.g. "-1001234567890")
  LINKED_CHANNEL_ID?: string; // Optional target linked channel ID/handle (e.g. "@turbonex_official")
  ADMIN_API_KEY?: string; // Dashboard / API authorization key
  COMMUNITY_NAME?: string;
  DEFAULT_VIOLATION_ACTION?: string;
  DB?: D1Database; // Cloudflare D1 Database binding
  ASSETS?: Fetcher; // Static assets binding for React SPA dashboard
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number | string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  chat_member?: any;
  my_chat_member?: any;
}

export interface ModerationSettings {
  delete_urls: boolean;
  delete_invites: boolean;
  delete_phone_numbers: boolean;
  anti_spam_enabled: boolean;
  burst_limit: number;
  burst_window_seconds: number;
  duplicate_limit: number;
  duplicate_window_seconds: number;
  violation_action: 'delete_only' | 'delete_and_warn' | 'mute_15m' | 'mute_1h';
  welcome_enabled: boolean;
  welcome_template: string;
  rules_link: string;
  community_name: string;
  admin_ids: number[];
}

export interface ScheduledPostRecord {
  id: string;
  channel_id: string;
  content: string;
  scheduled_epoch: number;
  created_by: number;
  parse_mode: string;
  status: 'pending' | 'publishing' | 'published' | 'failed' | 'canceled';
  error_message?: string | null;
  created_at: number;
  published_at?: number | null;
}
