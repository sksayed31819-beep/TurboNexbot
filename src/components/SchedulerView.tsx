import React, { useState, useEffect } from 'react';
import {
  Send,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Hash,
  Eye,
  Trash2,
  Radio,
  FileText,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { ModerationConfig } from '../lib/moderation';
import { fetchWithAdminAuth } from '../lib/adminAuth';

export interface ScheduledPostUI {
  id: string;
  channelId: string;
  content: string;
  scheduledTimeStr?: string;
  scheduledEpoch: number;
  status: 'pending' | 'publishing' | 'published' | 'failed' | 'canceled';
  errorMessage?: string | null;
  createdAt: number | string;
}

interface SchedulerViewProps {
  config: ModerationConfig;
}

export const SchedulerView: React.FC<SchedulerViewProps> = ({ config }) => {
  const [channelId, setChannelId] = useState('@turbonex_official');
  const [postContent, setPostContent] = useState(
    '🚀 **TurboNex Ecosystem Update v2.5**\n\n' +
      'We are rolling out advanced community security protocols, zero-spam protection, and automated channel broadcasts!\n\n' +
      '✨ Read full release notes: https://t.me/turbonex_rules\n' +
      '#TurboNex #TelegramBot #Web3'
  );
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPostUI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchPosts = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await fetchWithAdminAuth('/api/scheduled-posts');
      if (res.status === 401) {
        setActionError('Unauthorized: Please enter your ADMIN_API_KEY in the Admin Settings tab to view and manage scheduled posts.');
        return;
      }
      const data = (await res.json()) as any;
      if (data.success && data.posts) {
        setScheduledPosts(data.posts);
      }
    } catch (err: any) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleQueuePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) return;

    setActionError(null);
    setActionSuccess(null);

    const targetEpoch = Math.floor(Date.now() / 1000) + delayMinutes * 60;

    try {
      const res = await fetchWithAdminAuth('/api/scheduled-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channelId.trim(),
          content: postContent.trim(),
          scheduledEpoch: targetEpoch,
          createdBy: 0,
          parseMode: 'Markdown',
        }),
      });

      if (res.status === 401) {
        setActionError('Unauthorized: Valid ADMIN_API_KEY required. Authenticate in the Admin Settings tab.');
        return;
      }

      const data = (await res.json()) as any;
      if (data.success) {
        setActionSuccess(`Post queued in Cloudflare D1 for ${delayMinutes}m from now!`);
        setPostContent('');
        fetchPosts();
      } else {
        setActionError(data.error || 'Failed to schedule post.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error while queuing post.');
    }
  };

  const handlePublishNow = async (id: string) => {
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetchWithAdminAuth(`/api/scheduled-posts/${id}/publish`, {
        method: 'POST',
      });

      if (res.status === 401) {
        setActionError('Unauthorized: Valid ADMIN_API_KEY required to trigger broadcast.');
        return;
      }

      const data = (await res.json()) as any;

      if (data.success) {
        setActionSuccess(`Post ${id} was published to Telegram successfully!`);
        fetchPosts();
      } else {
        setActionError(`Telegram Error: ${data.error || 'Failed to dispatch post.'}`);
        fetchPosts();
      }
    } catch (err: any) {
      setActionError(err.message || 'Error executing publish request.');
    }
  };

  const handleCancelPost = async (id: string) => {
    try {
      const res = await fetchWithAdminAuth(`/api/scheduled-posts/${id}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        setActionError('Unauthorized: Valid ADMIN_API_KEY required to cancel post.');
        return;
      }
      const data = (await res.json()) as any;
      if (data.success) {
        fetchPosts();
      } else {
        setActionError(data.error || 'Failed to cancel post.');
      }
    } catch (err: any) {
      console.error('Failed to cancel post:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-4 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-semibold mb-1">
            <Radio className="w-5 h-5" />
            <span>Cloudflare D1 Channel Post Scheduler</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Queue announcements for your linked channel. Stored persistently in Cloudflare D1 and dispatched by Workers Cron Triggers.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchPosts}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh Scheduled Posts Queue"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300">
            <Hash className="w-4 h-4 text-cyan-400" />
            <span>Target: {channelId}</span>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Creator Form */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-cyan-400" />
              Schedule New Announcement
            </h4>

            <form onSubmit={handleQueuePost} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Linked Channel Username or ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    @
                  </span>
                  <input
                    type="text"
                    value={channelId.replace(/^@/, '')}
                    onChange={(e) => setChannelId(`@${e.target.value.replace(/^@/, '')}`)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono"
                    placeholder="turbonex_official"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ensure the bot has been promoted to Admin in this channel with "Post Messages" permission.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Announcement Content (Markdown Supported)
                </label>
                <textarea
                  rows={6}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Type your announcement... Use **bold**, _italic_, or links."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 leading-relaxed font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Schedule Publication In:</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {delayMinutes < 60 ? `${delayMinutes} Minutes` : `${(delayMinutes / 60).toFixed(1)} Hours`}
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 15, 60, 1440].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDelayMinutes(mins)}
                      className={`py-1.5 text-xs rounded-lg font-medium border transition-colors ${
                        delayMinutes === mins
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {mins === 5 ? '5m' : mins === 15 ? '15m' : mins === 60 ? '1h' : '24h'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-cyan-600/20 transition-all"
              >
                <Calendar className="w-4 h-4" />
                <span>Queue Post in D1 for {delayMinutes}m From Now</span>
              </button>
            </form>
          </div>
        </div>

        {/* Queue List & Live Status */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                D1 Scheduled Posts Queue ({scheduledPosts.length})
              </h4>
              <span className="text-xs text-slate-400 font-mono">Cloudflare D1 &amp; Cron</span>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {scheduledPosts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No scheduled posts in database.
                </div>
              ) : (
                scheduledPosts.map((post) => {
                  const isPending = post.status === 'pending';
                  const isPublished = post.status === 'published';
                  const isFailed = post.status === 'failed';
                  const dueTime = new Date(post.scheduledEpoch * 1000).toLocaleString();

                  return (
                    <div
                      key={post.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-cyan-400 font-bold">{post.id}</span>
                          <span className="text-slate-400 font-mono">{post.channelId}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-semibold text-[10px] ${
                            isPublished
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : isPending
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : isFailed
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {post.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900/80 rounded-lg text-slate-200 font-sans leading-relaxed whitespace-pre-wrap border border-slate-800/60">
                        {post.content}
                      </div>

                      {post.errorMessage && (
                        <div className="text-rose-400 font-mono text-[11px] bg-rose-950/20 p-2 rounded border border-rose-900/40">
                          Error: {post.errorMessage}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Due: {dueTime}
                        </span>

                        {isPending && (
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handlePublishNow(post.id)}
                              className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-medium transition-colors"
                            >
                              Dispatch Now
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelPost(post.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Cancel post"
                              aria-label="Cancel scheduled post"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
