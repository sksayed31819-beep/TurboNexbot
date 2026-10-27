import React, { useState, useEffect } from 'react';
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Lock,
  ExternalLink,
  Shield,
  HelpCircle,
  Copy,
  Check,
  Radio,
} from 'lucide-react';
import { fetchWithAdminAuth } from '../lib/adminAuth';

export const WebhookManager: React.FC = () => {
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workerUrlInput, setWorkerUrlInput] = useState('');
  const [secretTokenInput, setSecretTokenInput] = useState('');
  const [setSuccessMsg, setSetSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchWebhookInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAdminAuth('/api/webhook/info');
      if (res.status === 401) {
        setError('Authentication Required: Please enter your ADMIN_API_KEY in the Admin Settings tab to inspect Telegram webhook info.');
        return;
      }
      const data = (await res.json()) as any;
      if (data.success && data.result) {
        setWebhookInfo(data.result);
        if (data.result.url && !workerUrlInput) {
          setWorkerUrlInput(data.result.url);
        }
      } else {
        setError(data.error || 'Failed to retrieve webhook info from Telegram.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching webhook info.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhookInfo();
  }, []);

  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerUrlInput.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSetSuccessMsg(null);

    try {
      const res = await fetchWithAdminAuth('/api/webhook/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: workerUrlInput.trim(),
          secretToken: secretTokenInput.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        setError('Unauthorized: Valid ADMIN_API_KEY required to register Telegram webhook. Authenticate in the Admin Settings tab.');
        return;
      }

      const data = (await res.json()) as any;
      if (data.success) {
        setSetSuccessMsg(`Webhook registered with Telegram! Target: ${data.targetUrl}`);
        fetchWebhookInfo();
      } else {
        setError(data.error || 'Telegram rejected webhook registration.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit webhook request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-semibold mb-1">
            <Globe className="w-5 h-5" />
            <span>Cloudflare Workers Webhook Gateway</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Telegram delivers updates directly to your Cloudflare Worker endpoint via HTTPS POST requests authenticated with <code className="text-cyan-300 font-mono">X-Telegram-Bot-Api-Secret-Token</code>.
          </p>
        </div>

        <button
          onClick={fetchWebhookInfo}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Live Status</span>
        </button>
      </div>

      {/* Critical Telegram Bot Permissions Notice */}
      <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs space-y-2">
        <div className="flex items-center space-x-2 font-bold text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>CRITICAL: Telegram Group Privacy Settings Required</span>
        </div>
        <p className="leading-relaxed text-slate-300">
          By default, Telegram bots have <strong>Group Privacy Mode enabled</strong>, which blinds the bot from seeing regular member chat messages. For the bot to detect and delete links, phone numbers, and spam, you <strong>MUST</strong> disable privacy:
        </p>
        <div className="bg-slate-950/80 p-3 rounded-xl border border-amber-900/40 font-mono text-xs text-amber-300 space-y-1">
          <div>1. Open Telegram and message <strong className="text-white">@BotFather</strong></div>
          <div>2. Send <strong className="text-white">/setprivacy</strong></div>
          <div>3. Select your bot: <strong className="text-white">@YourTurboNexBot</strong></div>
          <div>4. Choose: <strong className="text-emerald-400">Disable</strong></div>
        </div>
      </div>

      {/* Grid: Webhook Status & Registration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Telegram Webhook Status */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                Live Telegram Webhook Status
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-cyan-500/10 text-cyan-300 rounded border border-cyan-500/20">
                Telegram API
              </span>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="break-all">{error}</span>
              </div>
            )}

            {setSuccessMsg && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{setSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <div className="text-slate-400 font-medium">Configured Webhook URL on Telegram:</div>
                <div className="font-mono text-cyan-300 break-all text-xs">
                  {webhookInfo?.url || (webhookInfo ? '(No webhook registered - polling mode)' : 'Loading or not configured in environment...')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <div className="text-slate-400">Pending Updates:</div>
                  <div className="text-base font-bold text-white font-mono mt-0.5">
                    {webhookInfo?.pending_update_count ?? 0}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <div className="text-slate-400">Custom Certificate:</div>
                  <div className="text-sm font-semibold text-white mt-0.5">
                    {webhookInfo?.has_custom_certificate ? 'Yes' : 'No (Cloudflare SSL)'}
                  </div>
                </div>
              </div>

              {webhookInfo?.last_error_message && (
                <div className="p-3 bg-rose-950/30 rounded-xl border border-rose-800/50 space-y-1">
                  <div className="text-rose-400 font-semibold">Last Telegram Delivery Error:</div>
                  <div className="font-mono text-rose-300 text-xs">
                    {webhookInfo.last_error_message}
                  </div>
                  {webhookInfo.last_error_date && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Timestamp: {new Date(webhookInfo.last_error_date * 1000).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Register Webhook Form */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                Register Webhook with Telegram
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                setWebhook API
              </span>
            </div>

            <form onSubmit={handleRegisterWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Cloudflare Worker Webhook URL (HTTPS required)
                </label>
                <input
                  type="url"
                  value={workerUrlInput}
                  onChange={(e) => setWorkerUrlInput(e.target.value)}
                  placeholder="https://turbonex-bot.your-subdomain.workers.dev/webhook"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The public URL of your deployed Cloudflare Worker ending in <code className="text-cyan-300">/webhook</code>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Telegram Secret Token (Optional if set in environment)</span>
                  <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-mono">
                    <Lock className="w-3 h-3" />
                    Header Verification
                  </span>
                </label>
                <input
                  type="password"
                  value={secretTokenInput}
                  onChange={(e) => setSecretTokenInput(e.target.value)}
                  placeholder="Leave empty to use TELEGRAM_SECRET_TOKEN from environment"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Telegram sends this in <code className="text-cyan-300 font-mono">X-Telegram-Bot-Api-Secret-Token</code> to guarantee only Telegram can call your worker.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !workerUrlInput.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center space-x-2 shadow-lg shadow-cyan-600/20 transition-all"
              >
                <Globe className="w-4 h-4" />
                <span>{isSubmitting ? 'Registering with Telegram...' : 'Register Webhook with Telegram'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
