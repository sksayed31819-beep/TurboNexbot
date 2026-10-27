"""
TurboNex Telegram Bot - Channel Post Scheduler
Allows authorized admins to queue, inspect, and automatically publish
scheduled posts to a linked Telegram channel.
"""

import asyncio
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger("TurboNexScheduler")


@dataclass
class ScheduledPost:
    """Represents a post scheduled for publication in a linked Telegram channel."""
    id: str
    channel_id: str
    content: str
    scheduled_epoch: float
    created_by_admin_id: int
    parse_mode: str = "Markdown"  # "Markdown", "HTML", or "None"
    status: str = "pending"  # "pending", "published", "failed", "canceled"
    error_message: Optional[str] = None
    created_at_epoch: float = field(default_factory=time.time)
    published_at_epoch: Optional[float] = None

    @property
    def scheduled_datetime_str(self) -> str:
        """Formatted human-readable scheduled time in UTC."""
        dt = datetime.utcfromtimestamp(self.scheduled_epoch)
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")

    def to_dict(self) -> dict:
        return asdict(self)


class ChannelPostScheduler:
    """Manages scheduled posts for linked Telegram channels."""
    def __init__(self):
        self._posts: Dict[str, ScheduledPost] = {}
        self._lock = asyncio.Lock() if asyncio.get_event_loop().is_running() else None

    def schedule_post(
        self,
        channel_id: str,
        content: str,
        scheduled_epoch: float,
        admin_id: int,
        parse_mode: str = "Markdown"
    ) -> ScheduledPost:
        """Schedules a new post. Raises ValueError if scheduled time is too far in the past."""
        now = time.time()
        if scheduled_epoch < (now - 60):  # Allow 1 min grace
            raise ValueError("Scheduled time cannot be in the past.")
        if not content.strip():
            raise ValueError("Post content cannot be empty.")
            
        post_id = str(uuid.uuid4())[:8]
        post = ScheduledPost(
            id=post_id,
            channel_id=channel_id,
            content=content.strip(),
            scheduled_epoch=scheduled_epoch,
            created_by_admin_id=admin_id,
            parse_mode=parse_mode,
            status="pending"
        )
        self._posts[post_id] = post
        return post

    def get_pending_due_posts(self, now: Optional[float] = None) -> List[ScheduledPost]:
        """Returns all pending posts whose scheduled time has arrived."""
        if now is None:
            now = time.time()
        due = []
        for post in self._posts.values():
            if post.status == "pending" and post.scheduled_epoch <= now:
                due.append(post)
        # Sort by scheduled time ascending
        due.sort(key=lambda p: p.scheduled_epoch)
        return due

    def mark_published(self, post_id: str) -> bool:
        """Marks a post as successfully dispatched."""
        post = self._posts.get(post_id)
        if post:
            post.status = "published"
            post.published_at_epoch = time.time()
            post.error_message = None
            return True
        return False

    def mark_failed(self, post_id: str, error_msg: str) -> bool:
        """Records a publication failure for retry or admin review."""
        post = self._posts.get(post_id)
        if post:
            post.status = "failed"
            post.error_message = error_msg
            return True
        return False

    def cancel_post(self, post_id: str) -> bool:
        """Cancels a pending post."""
        post = self._posts.get(post_id)
        if post and post.status == "pending":
            post.status = "canceled"
            return True
        return False

    def get_post(self, post_id: str) -> Optional[ScheduledPost]:
        return self._posts.get(post_id)

    def list_all(self) -> List[ScheduledPost]:
        """Lists all posts ordered by scheduled time."""
        posts = list(self._posts.values())
        posts.sort(key=lambda p: p.scheduled_epoch)
        return posts

    async def execute_due_posts(self, bot_dispatch_fn) -> int:
        """
        Executes pending due posts using the provided async dispatch function:
        bot_dispatch_fn(channel_id, content, parse_mode) -> bool
        Returns the number of successfully published posts.
        """
        now = time.time()
        due_posts = self.get_pending_due_posts(now)
        published_count = 0
        for post in due_posts:
            try:
                success = await bot_dispatch_fn(
                    channel_id=post.channel_id,
                    content=post.content,
                    parse_mode=post.parse_mode
                )
                if success:
                    self.mark_published(post.id)
                    published_count += 1
                else:
                    self.mark_failed(post.id, "Dispatch returned failure")
            except Exception as e:
                # Never expose full exception details if they might contain credentials
                safe_err = str(e)[:120]
                self.mark_failed(post.id, safe_err)
                logger.error("Failed to dispatch scheduled post %s: %s", post.id, safe_err)
        return published_count
