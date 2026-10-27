#!/usr/bin/env python3
from __future__ import annotations
"""
TurboNex Community Moderation Bot
A production-grade, secure Telegram bot for community protection and post scheduling.

Key Safeguards:
1. Deletes unauthorized URLs, invite links, and disguised scam domains from regular members.
2. Deletes shared phone numbers to protect member privacy and block external scam solicitation.
3. Anti-spam frequency (burst rate limiting) & duplicate message detection.
4. Customizable welcome message with dynamic tags ({mention}, {group_name}, {rules_link}).
5. Strict admin authorization for moderation settings and post scheduling.
6. Post scheduler for linked Telegram channels.
7. Zero token / secret leaks in console or error logs.
"""

import asyncio
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Optional

# Setup secure logging (sanitized)
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("TurboNexBot")

# Import local modules
try:
    from bot.config import BotConfig, mask_phone_number, mask_secret
    from bot.moderation import (
        SpamTracker,
        evaluate_message,
        format_welcome_message,
    )
    from bot.scheduler import ChannelPostScheduler
except ImportError:
    # If run directly inside the bot/ directory
    from config import BotConfig, mask_phone_number, mask_secret
    from moderation import (
        SpamTracker,
        evaluate_message,
        format_welcome_message,
    )
    from scheduler import ChannelPostScheduler

# Try importing telegram modules (v20+ async)
try:
    from telegram import (
        ChatPermissions,
        Update,
    )
    from telegram.constants import ParseMode
    from telegram.error import TelegramError
    from telegram.ext import (
        Application,
        ChatMemberHandler,
        CommandHandler,
        ContextTypes,
        MessageHandler,
        filters,
    )
    HAS_TELEGRAM = True
except ImportError:
    HAS_TELEGRAM = False
    logger.warning("python-telegram-bot is not installed. To run live, run: pip install -r requirements.txt")


class TurboNexBotApp:
    """Core controller for TurboNex community moderation."""
    def __init__(self, config: Optional[BotConfig] = None):
        self.config = config or BotConfig.from_env()
        self.spam_tracker = SpamTracker(
            burst_limit=self.config.burst_limit,
            burst_window=self.config.burst_window_seconds,
            duplicate_limit=self.config.duplicate_limit,
            duplicate_window=self.config.duplicate_window_seconds
        )
        self.scheduler = ChannelPostScheduler()
        self.app = None

    def verify_credentials(self) -> bool:
        """Verifies bot token exists without printing the secret."""
        if not self.config.bot_token or self.config.bot_token in ("YOUR_TELEGRAM_BOT_TOKEN", "MY_BOT_TOKEN"):
            logger.error("TELEGRAM_BOT_TOKEN is missing or using placeholder! Set TELEGRAM_BOT_TOKEN in .env or environment.")
            return False
        logger.info("Bot token verified (loaded securely as %s)", mask_secret(self.config.bot_token))
        logger.info("Admin count: %d authorized administrators", len(self.config.admin_ids))
        return True

    # ---------------------------------------------------------
    # Telegram Command Handlers
    # ---------------------------------------------------------

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Public /start handler."""
        user = update.effective_user
        is_admin = self.config.is_admin(user.id) if user else False
        status_line = "🛡️ Administrator Access Granted" if is_admin else "👤 Community Member"

        text = (
            f"⚡ **Welcome to TurboNex Moderation Bot** ⚡\n\n"
            f"Your Status: {status_line}\n"
            f"Community: `{self.config.community_name}`\n\n"
            f"**Active Community Safeguards:**\n"
            f"• 🚫 Anti-Link & Phishing Protection: {'Active' if self.config.delete_urls else 'Disabled'}\n"
            f"• 📱 Phone Number Shield: {'Active' if self.config.delete_phone_numbers else 'Disabled'}\n"
            f"• ⏱️ Anti-Spam & Burst Limiter: {'Active' if self.config.anti_spam_enabled else 'Disabled'}\n"
            f"• 👋 Welcome Greeting: {'Active' if self.config.welcome_enabled else 'Disabled'}\n\n"
        )
        if is_admin:
            text += (
                "**Admin Commands:**\n"
                "/settings - View current moderation config\n"
                "/toggle_links - Toggle URL filtering\n"
                "/toggle_phones - Toggle phone number filtering\n"
                "/toggle_antispam - Toggle anti-spam limiter\n"
                "/set_welcome <text> - Customize welcome template\n"
                "/schedule <seconds_from_now> <message> - Queue channel post\n"
            )
        else:
            text += "Please respect community rules. Links and numbers are strictly prohibited from members."

        await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

    async def cmd_settings(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin-only /settings handler."""
        user = update.effective_user
        if not user or not self.config.is_admin(user.id):
            await update.message.reply_text("⛔ **Unauthorized:** Only registered TurboNex admins can modify or view settings.", parse_mode=ParseMode.MARKDOWN)
            return

        safe_summary = self.config.get_safe_summary()
        text = (
            "⚙️ **TurboNex Moderation Settings**\n\n"
            f"• **Bot Token:** `{safe_summary['bot_token']}`\n"
            f"• **Admins Configured:** {safe_summary['admin_count']}\n"
            f"• **Linked Channel:** `{safe_summary['linked_channel_id'] or 'None'}`\n"
            f"• **Delete URLs:** `{safe_summary['delete_urls']}`\n"
            f"• **Delete Phone Numbers:** `{safe_summary['delete_phone_numbers']}`\n"
            f"• **Anti-Spam Enabled:** `{safe_summary['anti_spam_enabled']}`\n"
            f"  └ Burst: {safe_summary['burst_limit']} msgs in {safe_summary['burst_window_seconds']}s\n"
            f"  └ Duplicates: {safe_summary['duplicate_limit']} repeat limit\n"
            f"• **Violation Action:** `{safe_summary['violation_action']}`\n"
            f"• **Welcome Message:** `{'Enabled' if safe_summary['welcome_enabled'] else 'Disabled'}`\n\n"
            "Use `/toggle_links`, `/toggle_phones`, `/toggle_antispam`, or `/set_welcome` to update."
        )
        await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

    async def cmd_toggle_links(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin-only toggle for URL filter."""
        user = update.effective_user
        if not user or not self.config.is_admin(user.id):
            await update.message.reply_text("⛔ Unauthorized action.")
            return

        self.config.delete_urls = not self.config.delete_urls
        status = "ENABLED (URLs will be deleted)" if self.config.delete_urls else "DISABLED (URLs allowed)"
        await update.message.reply_text(f"🛡️ Link protection is now: **{status}**", parse_mode=ParseMode.MARKDOWN)
        logger.info("Admin %s toggled delete_urls to %s", user.id, self.config.delete_urls)

    async def cmd_toggle_phones(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin-only toggle for phone number filter."""
        user = update.effective_user
        if not user or not self.config.is_admin(user.id):
            await update.message.reply_text("⛔ Unauthorized action.")
            return

        self.config.delete_phone_numbers = not self.config.delete_phone_numbers
        status = "ENABLED (Phone numbers will be deleted)" if self.config.delete_phone_numbers else "DISABLED"
        await update.message.reply_text(f"📱 Phone protection is now: **{status}**", parse_mode=ParseMode.MARKDOWN)
        logger.info("Admin %s toggled delete_phone_numbers to %s", user.id, self.config.delete_phone_numbers)

    async def cmd_toggle_antispam(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin-only toggle for anti-spam limiter."""
        user = update.effective_user
        if not user or not self.config.is_admin(user.id):
            await update.message.reply_text("⛔ Unauthorized action.")
            return

        self.config.anti_spam_enabled = not self.config.anti_spam_enabled
        status = "ENABLED" if self.config.anti_spam_enabled else "DISABLED"
        await update.message.reply_text(f"⏱️ Anti-spam limiter is now: **{status}**", parse_mode=ParseMode.MARKDOWN)
        logger.info("Admin %s toggled anti_spam_enabled to %s", user.id, self.config.anti_spam_enabled)

    async def cmd_set_welcome(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin-only command to update welcome template."""
        user = update.effective_user
        if not user or not self.config.is_admin(user.id):
            await update.message.reply_text("⛔ Unauthorized action.")
            return

        if not context.args:
            await update.message.reply_text(
                "ℹ️ Usage: `/set_welcome <your message>`\n"
                "Supported variables: `{mention}`, `{username}`, `{group_name}`, `{rules_link}`",
                parse_mode=ParseMode.MARKDOWN
            )
            return

        new_template = " ".join(context.args)
        self.config.welcome_template = new_template
        await update.message.reply_text(
            f"✅ Welcome message updated!\n\n**Preview:**\n{new_template.format(mention='@new_member', username='@new_member', group_name=self.config.community_name, rules_link=self.config.rules_link)}",
            parse_mode=ParseMode.MARKDOWN
        )
        logger.info("Admin %s updated welcome template", user.id)

    async def cmd_schedule(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin-only command to schedule a post to the linked channel."""
        user = update.effective_user
        if not user or not self.config.is_admin(user.id):
            await update.message.reply_text("⛔ Unauthorized action.")
            return

        if not self.config.linked_channel_id:
            await update.message.reply_text("⚠️ No linked channel configured. Set `CHANNEL_ID` in your environment.")
            return

        if not context.args or len(context.args) < 2:
            await update.message.reply_text(
                "ℹ️ Usage: `/schedule <delay_seconds> <message text>`\n"
                "Example: `/schedule 3600 🚀 Big announcement coming at 6 PM UTC!`",
                parse_mode=ParseMode.MARKDOWN
            )
            return

        try:
            delay = int(context.args[0])
            content = " ".join(context.args[1:])
            target_time = time.time() + delay
            
            post = self.scheduler.schedule_post(
                channel_id=self.config.linked_channel_id,
                content=content,
                scheduled_epoch=target_time,
                admin_id=user.id
            )
            await update.message.reply_text(
                f"📅 **Post Scheduled Successfully!**\n\n"
                f"• **Post ID:** `{post.id}`\n"
                f"• **Channel:** `{post.channel_id}`\n"
                f"• **Dispatch In:** {delay} seconds ({post.scheduled_datetime_str})\n"
                f"• **Content:**\n_{content}_",
                parse_mode=ParseMode.MARKDOWN
            )
            logger.info("Admin %s scheduled post %s for channel %s in %ds", user.id, post.id, post.channel_id, delay)
        except ValueError as e:
            await update.message.reply_text(f"❌ Error: {e}")

    # ---------------------------------------------------------
    # Core Message Moderation Handler
    # ---------------------------------------------------------

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Inspects every incoming group message against TurboNex moderation rules."""
        if not update.message or not update.message.text:
            return

        user = update.effective_user
        chat = update.effective_chat
        if not user:
            return

        is_admin = self.config.is_admin(user.id)
        text = update.message.text

        decision = evaluate_message(
            text=text,
            user_id=user.id,
            is_admin=is_admin,
            config=self.config,
            spam_tracker=self.spam_tracker
        )

        if decision.should_delete:
            try:
                # 1. Delete offending message
                await update.message.delete()
                
                # 2. Log incident securely (never log full phone number or user token)
                sanitized_detail = (
                    mask_phone_number(decision.matched_detail) 
                    if decision.violation_type == "phone" 
                    else decision.matched_detail[:60]
                )
                logger.info(
                    "MODERATED: Deleted %s from user_id=%s in chat=%s. Reason: %s [%s]",
                    decision.violation_type, user.id, chat.id if chat else "unknown",
                    decision.reason, sanitized_detail
                )

                # 3. Take configured penalty action
                if decision.penalty_action == "delete_and_warn":
                    user_handle = f"@{user.username}" if user.username else user.first_name
                    warn_msg = await chat.send_message(
                        f"⚠️ {user_handle}, your message was deleted: **{decision.reason}**.\n"
                        f"Please keep TurboNex safe for all members.",
                        parse_mode=ParseMode.MARKDOWN
                    )
                    # Delete the warning message after 8 seconds to prevent group clutter
                    asyncio.create_task(self._auto_delete_message(warn_msg, delay=8))

                elif decision.penalty_action.startswith("mute_"):
                    # Temporary mute
                    mute_seconds = 900 if "15m" in decision.penalty_action else 3600
                    until_epoch = int(time.time() + mute_seconds)
                    try:
                        await chat.restrict_member(
                            user_id=user.id,
                            permissions=ChatPermissions(can_send_messages=False),
                            until_date=datetime.fromtimestamp(until_epoch, tz=timezone.utc)
                        )
                        await chat.send_message(
                            f"🔇 User muted for {mute_seconds // 60} minutes due to persistent rule violation."
                        )
                    except TelegramError as e:
                        logger.warning("Could not restrict member (missing bot permissions?): %s", e)

            except TelegramError as e:
                logger.error("Failed to delete message (bot lacks 'Delete Messages' admin right?): %s", e)

    async def _auto_delete_message(self, message, delay: int = 8) -> None:
        """Deletes a bot warning after a few seconds so the group remains clean."""
        await asyncio.sleep(delay)
        try:
            await message.delete()
        except Exception:
            pass

    # ---------------------------------------------------------
    # Welcome Handler for New Members
    # ---------------------------------------------------------

    async def handle_new_member(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Greets newly joined group members with the configured welcome template."""
        if not self.config.welcome_enabled:
            return

        chat = update.effective_chat
        if not chat:
            return

        # Check update.message.new_chat_members
        new_users = []
        if update.message and update.message.new_chat_members:
            new_users = update.message.new_chat_members

        for user in new_users:
            if user.is_bot:
                continue
            greeting = format_welcome_message(
                template=self.config.welcome_template,
                first_name=user.first_name,
                username=user.username,
                user_id=user.id,
                group_name=chat.title or self.config.community_name,
                rules_link=self.config.rules_link
            )
            try:
                await chat.send_message(greeting, parse_mode=ParseMode.MARKDOWN)
                logger.info("Welcomed new member user_id=%s into %s", user.id, chat.title)
            except TelegramError as e:
                logger.warning("Failed to send welcome message: %s", e)

    # ---------------------------------------------------------
    # Background Scheduler Worker
    # ---------------------------------------------------------

    async def scheduler_background_loop(self) -> None:
        """Periodically inspects the queue and posts due messages to the linked channel."""
        logger.info("Channel Post Scheduler background worker initialized.")
        while True:
            try:
                due_posts = self.scheduler.get_pending_due_posts(time.time())
                for post in due_posts:
                    if self.app and self.app.bot:
                        try:
                            await self.app.bot.send_message(
                                chat_id=post.channel_id,
                                text=post.content,
                                parse_mode=ParseMode.MARKDOWN
                            )
                            self.scheduler.mark_published(post.id)
                            logger.info("Successfully dispatched scheduled post %s to channel %s", post.id, post.channel_id)
                        except Exception as e:
                            self.scheduler.mark_failed(post.id, str(e)[:100])
                            logger.error("Failed to post scheduled message to %s: %s", post.channel_id, e)
            except Exception as e:
                logger.error("Error in scheduler loop: %s", e)
            await asyncio.sleep(10)

    # ---------------------------------------------------------
    # Bot Runner
    # ---------------------------------------------------------

    def build_application(self) -> "Application":
        """Builds and wires the python-telegram-bot application."""
        if not HAS_TELEGRAM:
            raise RuntimeError("python-telegram-bot is required to run the bot. Install with pip install python-telegram-bot")

        builder = Application.builder().token(self.config.bot_token)
        app = builder.build()
        self.app = app

        # Register command handlers
        app.add_handler(CommandHandler("start", self.cmd_start))
        app.add_handler(CommandHandler("help", self.cmd_start))
        app.add_handler(CommandHandler("settings", self.cmd_settings))
        app.add_handler(CommandHandler("toggle_links", self.cmd_toggle_links))
        app.add_handler(CommandHandler("toggle_phones", self.cmd_toggle_phones))
        app.add_handler(CommandHandler("toggle_antispam", self.cmd_toggle_antispam))
        app.add_handler(CommandHandler("set_welcome", self.cmd_set_welcome))
        app.add_handler(CommandHandler("schedule", self.cmd_schedule))

        # Register message filter
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))

        # Register welcome handler
        app.add_handler(MessageHandler(filters.StatusUpdate.NEW_CHAT_MEMBERS, self.handle_new_member))

        return app

    def run_polling(self) -> None:
        """Starts the bot in long polling mode with the scheduler background task."""
        if not self.verify_credentials():
            sys.exit(1)

        app = self.build_application()
        
        # Start background scheduler task on startup
        async def post_init(application: Application):
            asyncio.create_task(self.scheduler_background_loop())
            logger.info("TurboNex Telegram Bot started successfully in polling mode.")
            logger.info("Community: %s | Moderation Active: YES", self.config.community_name)

        app.post_init = post_init
        app.run_polling(drop_pending_updates=True)


def main():
    """Entry point supporting test, check-config, and run modes."""
    if "--check-config" in sys.argv:
        cfg = BotConfig.from_env()
        print("=== TurboNex Bot Configuration Summary ===")
        summary = cfg.get_safe_summary()
        for k, v in summary.items():
            print(f"  {k}: {v}")
        print("Configuration syntax: VALID (secrets masked)")
        return

    bot = TurboNexBotApp()
    bot.run_polling()


if __name__ == "__main__":
    main()
