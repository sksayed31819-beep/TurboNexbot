"""
TurboNex Community Moderation Engine
Core pure logic for detecting URLs, invite links, phone numbers, and spam.
Independent of Telegram API for fast, deterministic unit testing.
"""

import re
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

# Common top-level domains for catching bare links without http://
COMMON_TLDS = (
    r"com|net|org|io|xyz|co|me|top|biz|info|cc|online|site|app|dev|link|"
    r"vip|pro|shop|buzz|live|icu|ru|cn|in|gg|tech|club|space|fun|agency|"
    r"finance|cash|crypt|token|exchange|market|store|website|cloud"
)

# Regex for standard URLs (http, https, ftp, www)
REGEX_HTTP_URL = re.compile(
    r"(?:https?|ftp)://[^\s/$.?#].[^\s]*",
    re.IGNORECASE
)

# Regex for bare domain names (e.g. google.com, turbonex.xyz/claim)
REGEX_BARE_DOMAIN = re.compile(
    rf"\b(?:[a-zA-Z0-9-]+\.)+(?:{COMMON_TLDS})\b(?:/[^\s]*)?",
    re.IGNORECASE
)

# Regex specifically for Telegram invite links and channels
# Catches t.me/..., telegram.me/..., telegram.dog/...
REGEX_TELEGRAM_INVITE = re.compile(
    r"(?:https?://)?(?:www\.)?(?:t|telegram)\.(?:me|dog)/(?:joinchat/|\+[a-zA-Z0-9_-]+|[a-zA-Z0-9_]{4,})",
    re.IGNORECASE
)

# Regex for obfuscated URLs like "example [dot] com", "scam (dot) xyz", "free . crypto . com", "turbonex dot io"
REGEX_OBFUSCATED_DOT = re.compile(
    rf"\b[a-zA-Z0-9_-]+(?:\s*(?:\[dot\]|\(dot\)|\bdot\b|\.)\s*[a-zA-Z0-9_-]+)*\s*(?:\[dot\]|\(dot\)|\bdot\b|\.)\s*(?:{COMMON_TLDS})\b",
    re.IGNORECASE
)

# Phone number detection
# Catches:
# 1. E.164 / International: +1 555 123 4567, +44 7911 123456, +91 9876543210
# 2. Standard formatted: (555) 123-4567, 555-123-4567, 1-800-555-0199
# 3. Spaced / hyphenated sequences of 10-15 digits
# Excludes: short numbers, standard years (1990-2035), prices, version numbers
REGEX_INTERNATIONAL_PHONE = re.compile(
    r"(?:\+|00)\s*[1-9]\d{0,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}"
)

REGEX_FORMATTED_PHONE = re.compile(
    r"(?<!\w)(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]\d{3}[\s.-]\d{4}\b"
)

# Catches disguised spaced numbers often used by scammers: e.g. "9 8 7 6 5 4 3 2 1 0" or "+1 - 5 5 5 - 2 3 4"
REGEX_SPACED_PHONE = re.compile(
    r"(?<!\w)(?:\+\s*1\s*)?(?:\d\s*[-.\s]\s*){9,14}\d(?!\w)"
)

# Regex to detect phrases commonly accompanying phone sharing
REGEX_PHONE_KEYWORDS = re.compile(
    r"\b(?:call|phone|whatsapp|tel|text|contact)\s*(?:me|us|at|on)?\s*[:\s]*([+\d\s().-]{7,25})",
    re.IGNORECASE
)


def contains_url(text: str, check_obfuscation: bool = True) -> Tuple[bool, str]:
    """
    Checks if a given text contains any URL, web link, or Telegram invite.
    Returns: (has_url: bool, matched_snippet: str)
    """
    if not text:
        return False, ""
    
    # Check Telegram invite links
    match = REGEX_TELEGRAM_INVITE.search(text)
    if match:
        return True, f"Telegram invite/link: {match.group(0)}"
    
    # Check HTTP/HTTPS links
    match = REGEX_HTTP_URL.search(text)
    if match:
        return True, f"URL: {match.group(0)}"
    
    # Check bare domain links (e.g. google.com, airdrop.xyz)
    match = REGEX_BARE_DOMAIN.search(text)
    if match:
        return True, f"Domain link: {match.group(0)}"
    
    # Check obfuscated dots (e.g. domain [dot] com)
    if check_obfuscation:
        match = REGEX_OBFUSCATED_DOT.search(text)
        if match:
            return True, f"Obfuscated link: {match.group(0)}"
            
    return False, ""


def is_safe_number(match_text: str) -> bool:
    """
    Filters out common false positives like years (2020-2035), timestamps,
    or pure 4-digit numbers.
    """
    digits_only = re.sub(r"\D", "", match_text)
    # A genuine phone number typically has at least 7 digits (local) or 10-15 digits (standard)
    if len(digits_only) < 7:
        return True
    # If exactly 7 digits but no separators/plus, could be a large count, require phone formatting
    if len(digits_only) == 7 and not any(c in match_text for c in "()-+ "):
        return True
    # If 8-9 digits without international prefix or formatting, check if it's just a raw number
    if len(digits_only) < 10 and not match_text.strip().startswith("+") and "(" not in match_text:
        return True
    return False


def contains_phone_number(text: str) -> Tuple[bool, str]:
    """
    Checks if a message contains a phone number.
    Returns: (has_phone: bool, matched_phone: str)
    """
    if not text:
        return False, ""
    
    # Check phone keyword accompanied by digits
    match = REGEX_PHONE_KEYWORDS.search(text)
    if match:
        snippet = match.group(1).strip()
        digits = re.sub(r"\D", "", snippet)
        if len(digits) >= 7:
            return True, f"Phone with keyword: {snippet}"

    # Check international phone with '+'
    for m in REGEX_INTERNATIONAL_PHONE.finditer(text):
        matched = m.group(0).strip()
        if not is_safe_number(matched):
            return True, matched
            
    # Check US / standard formatted numbers: (555) 123-4567 or 555-123-4567
    for m in REGEX_FORMATTED_PHONE.finditer(text):
        matched = m.group(0).strip()
        if not is_safe_number(matched):
            return True, matched
            
    # Check spaced digits scam numbers: 9 8 7 6 5 4 3 2 1 0
    match = REGEX_SPACED_PHONE.search(text)
    if match:
        matched = match.group(0).strip()
        digits = re.sub(r"\D", "", matched)
        if len(digits) >= 10:
            return True, f"Spaced phone: {matched}"

    return False, ""


def normalize_text_for_spam(text: str) -> str:
    """Normalizes text for duplicate comparison by removing case and extra spaces/punctuation."""
    # Remove emojis and punctuation, collapse multiple whitespaces
    lowered = text.lower()
    cleaned = re.sub(r"[^\w\s]", "", lowered)
    return " ".join(cleaned.split())


class SpamTracker:
    """
    In-memory anti-spam tracker per user.
    Tracks:
    1. Burst frequency (e.g. > 5 messages in 8 seconds)
    2. Repeated identical/near-identical messages (e.g. 3 copies within 30 seconds)
    """
    def __init__(
        self,
        burst_limit: int = 5,
        burst_window: float = 8.0,
        duplicate_limit: int = 3,
        duplicate_window: float = 30.0,
    ):
        self.burst_limit = burst_limit
        self.burst_window = burst_window
        self.duplicate_limit = duplicate_limit
        self.duplicate_window = duplicate_window
        
        # User ID -> deque of timestamps
        self._user_timestamps: Dict[int, deque] = defaultdict(deque)
        # User ID -> deque of (normalized_text, timestamp)
        self._user_messages: Dict[int, deque] = defaultdict(deque)

    def record_and_check(self, user_id: int, message_text: str, now: Optional[float] = None) -> Tuple[bool, str]:
        """
        Records the message from user_id and evaluates if it violates anti-spam rules.
        Returns: (is_spam: bool, reason: str)
        """
        if now is None:
            now = time.time()
            
        # 1. Check Burst Rate
        timestamps = self._user_timestamps[user_id]
        # Prune old timestamps
        while timestamps and (now - timestamps[0]) > self.burst_window:
            timestamps.popleft()
        
        timestamps.append(now)
        if len(timestamps) > self.burst_limit:
            count = len(timestamps)
            return True, f"Excessive posting rate ({count} messages in under {self.burst_window:.0f}s)"

        # 2. Check Repeated / Duplicate Messages
        norm_text = normalize_text_for_spam(message_text)
        # Ignore very short messages (e.g. "ok", "yes", "gm") for duplicate detection
        if len(norm_text) >= 4:
            messages = self._user_messages[user_id]
            # Prune old messages
            while messages and (now - messages[0][1]) > self.duplicate_window:
                messages.popleft()
                
            messages.append((norm_text, now))
            
            # Count duplicates of the same text
            duplicate_count = sum(1 for m, _ in messages if m == norm_text)
            if duplicate_count >= self.duplicate_limit:
                return True, f"Repeated message detected ({duplicate_count} identical messages within {self.duplicate_window:.0f}s)"

        return False, ""

    def reset_user(self, user_id: int) -> None:
        """Clears tracking records for a specific user."""
        self._user_timestamps.pop(user_id, None)
        self._user_messages.pop(user_id, None)


@dataclass
class ModerationDecision:
    """Represents the verdict of moderating a single message."""
    should_delete: bool
    violation_type: Optional[str] = None  # "url", "phone", "spam", None
    reason: str = ""
    matched_detail: str = ""
    penalty_action: str = "none"  # "delete_only", "delete_and_warn", "mute", "none"


def evaluate_message(
    text: str,
    user_id: int,
    is_admin: bool,
    config,
    spam_tracker: Optional[SpamTracker] = None,
    now: Optional[float] = None
) -> ModerationDecision:
    """
    Evaluates a Telegram message against community moderation rules.
    Admins are authorized and bypass content filters.
    Regular members are subject to link, phone, and anti-spam filters.
    """
    # Rule 0: Admins bypass all automated deletion rules
    if is_admin:
        return ModerationDecision(
            should_delete=False,
            reason="Admin authorized - bypass active",
            penalty_action="none"
        )
    
    # Rule 1: Anti-spam check (frequency and duplicates)
    if config.anti_spam_enabled and spam_tracker is not None:
        is_spam, spam_reason = spam_tracker.record_and_check(user_id, text, now=now)
        if is_spam:
            return ModerationDecision(
                should_delete=True,
                violation_type="spam",
                reason=spam_reason,
                matched_detail="Spam threshold exceeded",
                penalty_action=config.violation_action
            )

    # Rule 2: URL & Invite link filter
    if config.delete_urls:
        has_url, url_match = contains_url(text)
        if has_url:
            return ModerationDecision(
                should_delete=True,
                violation_type="url",
                reason="Unauthorized external link or Telegram invite",
                matched_detail=url_match,
                penalty_action=config.violation_action
            )

    # Rule 3: Phone number filter
    if config.delete_phone_numbers:
        has_phone, phone_match = contains_phone_number(text)
        if has_phone:
            return ModerationDecision(
                should_delete=True,
                violation_type="phone",
                reason="Sharing phone numbers is strictly prohibited for member safety",
                matched_detail=phone_match,
                penalty_action=config.violation_action
            )

    # All checks passed
    return ModerationDecision(
        should_delete=False,
        reason="Message complies with TurboNex community rules",
        penalty_action="none"
    )


def format_welcome_message(
    template: str,
    first_name: str,
    username: Optional[str],
    user_id: int,
    group_name: str,
    rules_link: str
) -> str:
    """
    Renders the welcome template with user and group variables.
    Supported variables: {mention}, {username}, {user_id}, {group_name}, {rules_link}
    """
    if username:
        mention = f"@{username}"
    else:
        # Markdown link mention or first name
        mention = f"[{first_name}](tg://user?id={user_id})"
        
    user_handle = f"@{username}" if username else first_name
    
    return template.format(
        mention=mention,
        username=user_handle,
        user_id=str(user_id),
        group_name=group_name,
        rules_link=rules_link
    )
