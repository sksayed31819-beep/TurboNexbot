"""
TurboNex Telegram Moderation Bot - Configuration & Secrets Manager
Ensures tokens and secrets are strictly retrieved from environment variables
and NEVER exposed in logs, exceptions, or console output.
"""

import os
import re
from dataclasses import dataclass, field
from typing import Set

# Try loading from .env if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def mask_secret(secret: str, visible_start: int = 4, visible_end: int = 4) -> str:
    """
    Safely masks sensitive secrets (tokens, api keys).
    Example: '7182938472:AAElskdfj-XYZ12345' -> '7182***2345'
    Never returns the full secret.
    """
    if not secret:
        return "[NOT SET]"
    secret_str = str(secret).strip()
    if len(secret_str) <= (visible_start + visible_end):
        return "***REDACTED***"
    return f"{secret_str[:visible_start]}***{secret_str[-visible_end:]}"


def mask_phone_number(phone: str) -> str:
    """
    Masks a detected phone number for privacy in logs.
    Example: '+1 (555) 234-5678' -> '+1 (555) ***-**78'
    """
    if not phone:
        return ""
    digits = re.findall(r'\d', phone)
    if len(digits) <= 4:
        return "***"
    # Keep country code if any and last 2 digits
    return f"{phone[:4]}***{phone[-2:]}"


@dataclass
class BotConfig:
    """Application configuration loaded securely from environment."""
    bot_token: str
    admin_ids: Set[int]
    linked_channel_id: str
    community_name: str = "TurboNex Community"
    
    # Moderation policy defaults
    delete_urls: bool = True
    delete_invites: bool = True
    delete_phone_numbers: bool = True
    anti_spam_enabled: bool = True
    
    # Anti-spam thresholds
    burst_limit: int = 5  # Max messages allowed within burst_window
    burst_window_seconds: float = 8.0  # Sliding window in seconds
    duplicate_limit: int = 3  # Max identical messages before penalty
    duplicate_window_seconds: float = 30.0
    
    # Action on violation: "delete_only", "delete_and_warn", "mute_15m", "mute_1h"
    violation_action: str = "delete_and_warn"
    
    # Welcome message configuration
    welcome_enabled: bool = True
    welcome_template: str = (
        "👋 Welcome {mention} to {group_name}!\n\n"
        "⚡ We are thrilled to have you here.\n"
        "📜 Please review our community guidelines.\n"
        "🚫 No external URLs, Telegram invite links, or phone numbers are permitted from regular members.\n"
        "Enjoy your stay!"
    )
    rules_link: str = "https://t.me/turbonex_rules"

    @classmethod
    def from_env(cls) -> "BotConfig":
        """Loads configuration strictly from environment variables."""
        token = os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("BOT_TOKEN", "").strip()
        
        # Parse admin IDs (comma-separated integers: e.g. "123456789,987654321")
        admin_ids_raw = os.getenv("ADMIN_IDS", "").strip()
        admin_ids: Set[int] = set()
        if admin_ids_raw:
            for item in admin_ids_raw.split(","):
                item_clean = item.strip()
                if item_clean.isdigit():
                    admin_ids.add(int(item_clean))
        
        channel_id = os.getenv("CHANNEL_ID") or os.getenv("LINKED_CHANNEL_ID", "").strip()
        community_name = os.getenv("COMMUNITY_NAME", "TurboNex Community").strip()
        
        return cls(
            bot_token=token,
            admin_ids=admin_ids,
            linked_channel_id=channel_id,
            community_name=community_name,
            delete_urls=os.getenv("DELETE_URLS", "true").lower() in ("true", "1", "yes"),
            delete_invites=os.getenv("DELETE_INVITES", "true").lower() in ("true", "1", "yes"),
            delete_phone_numbers=os.getenv("DELETE_PHONE_NUMBERS", "true").lower() in ("true", "1", "yes"),
            anti_spam_enabled=os.getenv("ANTI_SPAM_ENABLED", "true").lower() in ("true", "1", "yes"),
            burst_limit=int(os.getenv("BURST_LIMIT", "5")),
            burst_window_seconds=float(os.getenv("BURST_WINDOW_SECONDS", "8.0")),
            duplicate_limit=int(os.getenv("DUPLICATE_LIMIT", "3")),
            duplicate_window_seconds=float(os.getenv("DUPLICATE_WINDOW_SECONDS", "30.0")),
            violation_action=os.getenv("VIOLATION_ACTION", "delete_and_warn"),
            welcome_enabled=os.getenv("WELCOME_ENABLED", "true").lower() in ("true", "1", "yes"),
            welcome_template=os.getenv("WELCOME_TEMPLATE", cls.welcome_template),
            rules_link=os.getenv("RULES_LINK", cls.rules_link),
        )

    def is_admin(self, user_id: int) -> bool:
        """Returns True if the given Telegram user_id is an authorized administrator."""
        return user_id in self.admin_ids

    def get_safe_summary(self) -> dict:
        """Returns a configuration summary with all secrets properly masked."""
        return {
            "bot_token": mask_secret(self.bot_token),
            "admin_count": len(self.admin_ids),
            "admin_ids_masked": [f"***{str(aid)[-4:]}" if len(str(aid)) > 4 else "***" for aid in sorted(self.admin_ids)],
            "linked_channel_id": self.linked_channel_id,
            "community_name": self.community_name,
            "delete_urls": self.delete_urls,
            "delete_invites": self.delete_invites,
            "delete_phone_numbers": self.delete_phone_numbers,
            "anti_spam_enabled": self.anti_spam_enabled,
            "burst_limit": self.burst_limit,
            "burst_window_seconds": self.burst_window_seconds,
            "duplicate_limit": self.duplicate_limit,
            "duplicate_window_seconds": self.duplicate_window_seconds,
            "violation_action": self.violation_action,
            "welcome_enabled": self.welcome_enabled,
        }
