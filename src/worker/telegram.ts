/**
 * Real Telegram Bot API Client for Cloudflare Workers
 * Uses native fetch without external dependencies.
 * Automatically sanitizes all errors so bot tokens are NEVER exposed.
 */

export interface TelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

export class TelegramClient {
  private readonly baseUrl: string;

  constructor(private readonly botToken: string) {
    if (!botToken || botToken.trim() === '') {
      throw new Error('Telegram bot token cannot be empty.');
    }
    this.baseUrl = `https://api.telegram.org/bot${botToken.trim()}`;
  }

  private async callApi<T = any>(method: string, payload: Record<string, any>): Promise<TelegramApiResponse<T>> {
    const url = `${this.baseUrl}/${method}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as TelegramApiResponse<T>;
      return data;
    } catch (err: any) {
      // NEVER leak the URL which contains the bot token
      return {
        ok: false,
        error_code: 500,
        description: `Network or fetch error while calling Telegram API: ${err.message || 'Unknown error'}`,
      };
    }
  }

  /**
   * Sends a message to a chat or channel.
   */
  async sendMessage(
    chatId: number | string,
    text: string,
    options: {
      parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
      reply_to_message_id?: number;
      disable_web_page_preview?: boolean;
    } = {}
  ): Promise<TelegramApiResponse> {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'Markdown',
      reply_to_message_id: options.reply_to_message_id,
      disable_web_page_preview: options.disable_web_page_preview ?? true,
    });
  }

  /**
   * Deletes a message from a chat.
   * Requires bot to have 'can_delete_messages' permission in the group.
   */
  async deleteMessage(chatId: number | string, messageId: number): Promise<TelegramApiResponse<boolean>> {
    return this.callApi<boolean>('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  /**
   * Restricts a chat member (mutes them).
   * untilDate is unix epoch seconds.
   */
  async restrictChatMember(
    chatId: number | string,
    userId: number,
    untilDateEpoch: number
  ): Promise<TelegramApiResponse<boolean>> {
    return this.callApi<boolean>('restrictChatMember', {
      chat_id: chatId,
      user_id: userId,
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
      },
      until_date: untilDateEpoch,
    });
  }

  /**
   * Registers a webhook with Telegram, including the secret_token for verification.
   */
  async setWebhook(webhookUrl: string, secretToken: string): Promise<TelegramApiResponse<boolean>> {
    return this.callApi<boolean>('setWebhook', {
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ['message', 'edited_message', 'chat_member', 'my_chat_member'],
      drop_pending_updates: false,
    });
  }

  /**
   * Retrieves the current webhook status from Telegram.
   */
  async getWebhookInfo(): Promise<TelegramApiResponse<any>> {
    return this.callApi('getWebhookInfo', {});
  }

  /**
   * Deletes the registered webhook.
   */
  async deleteWebhook(dropPendingUpdates = false): Promise<TelegramApiResponse<boolean>> {
    return this.callApi<boolean>('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
  }

  /**
   * Verifies bot credentials with Telegram getMe.
   */
  async getMe(): Promise<TelegramApiResponse<any>> {
    return this.callApi('getMe', {});
  }
}
