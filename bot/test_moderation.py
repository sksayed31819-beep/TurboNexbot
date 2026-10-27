"""
Comprehensive Unit Tests for TurboNex Moderation Bot
Tests link detection, phone number detection, anti-spam, secret protection,
and admin authorization.
"""

import time
import unittest
from bot.config import BotConfig, mask_phone_number, mask_secret
from bot.moderation import (
    SpamTracker,
    contains_phone_number,
    contains_url,
    evaluate_message,
    format_welcome_message,
    normalize_text_for_spam,
)
from bot.scheduler import ChannelPostScheduler


class TestLinkDetection(unittest.TestCase):
    """Verifies automated detection of URLs, invite links, and disguised links."""

    def test_standard_http_urls(self):
        urls = [
            "Check this out: https://turbonex-rewards.com",
            "Go to http://phishing-site.xyz/login immediately",
            "Visit https://sub.domain.co.uk/page?ref=123",
            "http://example.com",
        ]
        for msg in urls:
            has_url, snippet = contains_url(msg)
            self.assertTrue(has_url, f"Expected URL detection for: {msg}")

    def test_bare_domain_urls(self):
        bare_urls = [
            "Claim your tokens at turbonex-airdrop.xyz now!",
            "Join crypto-free-bonus.top/claim",
            "Check my portfolio on website.io/project",
            "Visit binance-gift.com today",
        ]
        for msg in bare_urls:
            has_url, snippet = contains_url(msg)
            self.assertTrue(has_url, f"Expected bare domain detection for: {msg}")

    def test_telegram_invite_links(self):
        telegram_invites = [
            "Join our secret group: https://t.me/+AbCdEfGhIjKl",
            "New VIP channel at t.me/joinchat/XYZ12345678",
            "Chat with us on telegram.me/turbonex_scam",
            "t.me/turbonex_vip_leak",
        ]
        for msg in telegram_invites:
            has_url, snippet = contains_url(msg)
            self.assertTrue(has_url, f"Expected Telegram invite detection for: {msg}")

    def test_obfuscated_links(self):
        obfuscated = [
            "free bonus at turbonex [dot] xyz",
            "go to claimtokens (dot) com right now",
            "click my link: turbonex dot io",
        ]
        for msg in obfuscated:
            has_url, snippet = contains_url(msg)
            self.assertTrue(has_url, f"Expected obfuscated URL detection for: {msg}")

    def test_clean_messages_without_links(self):
        clean_messages = [
            "Hello everyone, excited to be in TurboNex community!",
            "What is the roadmap for version 2.4 release?",
            "I love the new app UI update.",
            "Can someone explain the staking rewards rate?",
            "Great job team, this looks solid.",
        ]
        for msg in clean_messages:
            has_url, _ = contains_url(msg)
            self.assertFalse(has_url, f"Clean message falsely flagged as URL: {msg}")


class TestPhoneNumberDetection(unittest.TestCase):
    """Verifies detection and redaction of phone numbers in messages."""

    def test_international_phone_numbers(self):
        phones = [
            "Call our support team at +1 555 234 5678 for help",
            "Reach out to +44 7911 123456 on WhatsApp",
            "Direct hotline: +91 98765 43210",
            "My contact is +971 50 123 4567",
        ]
        for msg in phones:
            has_phone, matched = contains_phone_number(msg)
            self.assertTrue(has_phone, f"Expected phone detection for: {msg}")

    def test_formatted_us_numbers(self):
        phones = [
            "Call (555) 382-9012 right away",
            "Emergency number: 555-839-2041",
            "Support is 1-800-555-0199",
        ]
        for msg in phones:
            has_phone, matched = contains_phone_number(msg)
            self.assertTrue(has_phone, f"Expected formatted phone detection for: {msg}")

    def test_disguised_spaced_numbers(self):
        disguised = [
            "WhatsApp me at 9 8 7 6 5 4 3 2 1 0",
            "call: + 1 - 5 5 5 - 8 3 9 - 2 0 4 1",
        ]
        for msg in disguised:
            has_phone, matched = contains_phone_number(msg)
            self.assertTrue(has_phone, f"Expected disguised phone detection for: {msg}")

    def test_safe_non_phone_numbers(self):
        safe_messages = [
            "Release date is 2026-10-27 in Q4",
            "We have 2500 active members today!",
            "My order number is #9812",
            "Price increased by $45.99 per unit",
            "Server port 3000 is open",
        ]
        for msg in safe_messages:
            has_phone, matched = contains_phone_number(msg)
            self.assertFalse(has_phone, f"False positive phone detection for '{msg}' (matched: {matched})")


class TestAntiSpamProtection(unittest.TestCase):
    """Verifies burst posting limits and duplicate message spam detection."""

    def setUp(self):
        self.tracker = SpamTracker(
            burst_limit=4,
            burst_window=5.0,
            duplicate_limit=3,
            duplicate_window=20.0
        )

    def test_burst_frequency_limit(self):
        user_id = 1001
        base_time = 1000.0
        
        # Messages 1 to 4 should pass
        for i in range(4):
            is_spam, reason = self.tracker.record_and_check(
                user_id, f"Different message {i}", now=base_time + (i * 0.5)
            )
            self.assertFalse(is_spam, f"Message {i+1} should not be spam")

        # 5th message within 5 seconds triggers burst spam
        is_spam, reason = self.tracker.record_and_check(
            user_id, "Fifth rapid message!", now=base_time + 2.5
        )
        self.assertTrue(is_spam)
        self.assertIn("Excessive posting rate", reason)

    def test_duplicate_message_spam(self):
        user_id = 1002
        base_time = 2000.0
        spam_text = "BUY TURBONEX TOKEN FAST AIRDROP 🚀🚀"

        # First 2 identical messages allowed
        for i in range(2):
            is_spam, _ = self.tracker.record_and_check(
                user_id, spam_text, now=base_time + (i * 2.0)
            )
            self.assertFalse(is_spam)

        # 3rd identical message within 20s triggers duplicate spam
        is_spam, reason = self.tracker.record_and_check(
            user_id, spam_text, now=base_time + 5.0
        )
        self.assertTrue(is_spam)
        self.assertIn("Repeated message detected", reason)

    def test_different_users_isolated(self):
        """Ensures rate limits for one user do not affect another user."""
        user_a = 2001
        user_b = 2002
        now = 3000.0

        for _ in range(4):
            self.tracker.record_and_check(user_a, "Spam msg", now=now)
        
        # User B sends message, should NOT be marked spam
        is_spam, _ = self.tracker.record_and_check(user_b, "Legit first message", now=now)
        self.assertFalse(is_spam)


class TestAdminAuthorizationAndBypass(unittest.TestCase):
    """Verifies admin authorization rules and setting protections."""

    def setUp(self):
        self.config = BotConfig(
            bot_token="TEST_BOT_TOKEN_12345",
            admin_ids={999001, 999002},
            linked_channel_id="@turbonex_channel",
            delete_urls=True,
            delete_phone_numbers=True,
            anti_spam_enabled=True,
        )
        self.tracker = SpamTracker()

    def test_admin_is_authorized(self):
        self.assertTrue(self.config.is_admin(999001))
        self.assertTrue(self.config.is_admin(999002))
        self.assertFalse(self.config.is_admin(123456))

    def test_admin_can_post_urls(self):
        admin_id = 999001
        admin_post = "Official update! Read our new medium post: https://turbonex.com/announcement"
        decision = evaluate_message(
            text=admin_post,
            user_id=admin_id,
            is_admin=True,
            config=self.config,
            spam_tracker=self.tracker
        )
        self.assertFalse(decision.should_delete)
        self.assertIn("Admin authorized", decision.reason)

    def test_regular_member_url_is_deleted(self):
        member_id = 555001
        member_post = "Check out this free crypto link: https://scam-site.xyz"
        decision = evaluate_message(
            text=member_post,
            user_id=member_id,
            is_admin=False,
            config=self.config,
            spam_tracker=self.tracker
        )
        self.assertTrue(decision.should_delete)
        self.assertEqual(decision.violation_type, "url")


class TestSecretSecurityAndRedaction(unittest.TestCase):
    """Verifies secrets and phone numbers are never leaked in logs or UI."""

    def test_secret_masking(self):
        raw_token = "7182938472:AAElskdfj-XYZ12345"
        masked = mask_secret(raw_token)
        self.assertNotIn("AAElskdfj", masked)
        self.assertTrue(masked.startswith("7182"))
        self.assertTrue(masked.endswith("2345"))
        self.assertIn("***", masked)

    def test_empty_secret_handling(self):
        self.assertEqual(mask_secret(""), "[NOT SET]")

    def test_phone_number_masking(self):
        phone = "+1 (555) 234-5678"
        masked = mask_phone_number(phone)
        self.assertNotIn("234", masked)
        self.assertIn("***", masked)


class TestWelcomeAndScheduler(unittest.TestCase):
    """Verifies welcome message formatting and channel post scheduler."""

    def test_welcome_message_formatting(self):
        template = "Welcome {mention} to {group_name}! Rules: {rules_link}"
        rendered = format_welcome_message(
            template=template,
            first_name="Alex",
            username="alex_dev",
            user_id=778899,
            group_name="TurboNex Official",
            rules_link="https://t.me/turbonex_rules"
        )
        self.assertIn("@alex_dev", rendered)
        self.assertIn("TurboNex Official", rendered)
        self.assertIn("https://t.me/turbonex_rules", rendered)

    def test_channel_scheduler_queue(self):
        scheduler = ChannelPostScheduler()
        now = time.time()
        
        # Schedule post 10 seconds into future
        post = scheduler.schedule_post(
            channel_id="@turbonex_announcements",
            content="🚀 TurboNex v2.5 Launching next week!",
            scheduled_epoch=now + 10,
            admin_id=999001
        )
        self.assertEqual(post.status, "pending")
        
        # Should not be due right now
        due = scheduler.get_pending_due_posts(now=now)
        self.assertEqual(len(due), 0)
        
        # Should be due at now + 15
        due_later = scheduler.get_pending_due_posts(now=now + 15)
        self.assertEqual(len(due_later), 1)
        self.assertEqual(due_later[0].id, post.id)
        
        # Mark published
        scheduler.mark_published(post.id)
        self.assertEqual(scheduler.get_post(post.id).status, "published")


if __name__ == "__main__":
    unittest.main()
