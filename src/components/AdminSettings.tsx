import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Shield,
  Check,
  AlertTriangle,
  Save,
  Sliders,
  UserCheck,
  Eye,
  Key,
} from 'lucide-react';
import { ModerationConfig, formatWelcomeMessageTS, maskSecretTS } from '../lib/moderation';
import { getAdminApiKey, setAdminApiKey, fetchWithAdminAuth } from '../lib/adminAuth';

interface AdminSettingsProps {
  config: ModerationConfig;
  onUpdateConfig: (newConfig: ModerationConfig) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ config, onUpdateConfig }) => {
  const [apiKeyInput, setApiKeyInput] = useState(getAdminApiKey());
  const [isUnlocked, setIsUnlocked] = useState(Boolean(getAdminApiKey()));
  const [authError, setAuthError] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local copy of config
  const [localConfig, setLocalConfig] = useState<ModerationConfig>({ ...config });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadSettings = async () => {
    setAuthError('');
    try {
      const res = await fetchWithAdminAuth('/api/settings');
      if (res.status === 401) {
        setIsUnlocked(false);
        setAuthError('Authentication Required: Please enter your ADMIN_API_KEY to access and edit settings.');
        return;
      }
      const data = (await res.json()) as any;
      if (data.success && data.settings) {
        setLocalConfig(data.settings);
        onUpdateConfig(data.settings);
        setIsUnlocked(true);
      } else {
        setAuthError(data.error || 'Failed to load settings.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Network error fetching settings.');
    }
  };

  useEffect(() => {
    if (getAdminApiKey()) {
      loadSettings();
    }
  }, []);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setAuthError('Please enter your configured ADMIN_API_KEY.');
      setIsUnlocked(false);
      return;
    }
    setAdminApiKey(cleanKey);
    loadSettings();
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetchWithAdminAuth('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConfig),
      });

      if (res.status === 401) {
        setIsUnlocked(false);
        setSaveError('Unauthorized: Invalid or missing ADMIN_API_KEY. Please authenticate above.');
        return;
      }

      const data = (await res.json()) as any;
      if (data.success) {
        onUpdateConfig(localConfig);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        setSaveError(data.error || 'Failed to save settings.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Network failure while saving settings.');
    }
  };

  const welcomePreview = formatWelcomeMessageTS(
    localConfig.welcomeTemplate,
    'Jordan',
    'jordan_crypto',
    889922,
    localConfig.communityName,
    localConfig.rulesLink
  );

  return (
    <div className="space-y-6">
      {/* Admin Authorization Barrier Header */}
      <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isUnlocked
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">
              {isUnlocked ? 'Admin Authorization: Authenticated' : 'Admin Security Gate: Key Required'}
            </h3>
            <p className="text-xs text-slate-400">
              Administrative APIs require a valid <code className="text-cyan-300 font-mono">ADMIN_API_KEY</code>.
            </p>
          </div>
        </div>

        {/* Auth Key Input */}
        <form onSubmit={handleAuthSubmit} className="flex items-center space-x-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-56">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500 text-xs">
              <Key className="w-3.5 h-3.5" />
            </span>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter ADMIN_API_KEY"
              aria-label="Admin API Key"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Authenticate
          </button>
        </form>
      </div>

      {authError && (
        <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${!isUnlocked ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Left Column: Moderation & Anti-Spam Toggles */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                Automated Moderation Toggles
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-cyan-500/10 text-cyan-300 rounded border border-cyan-500/20">
                Cloudflare D1 Synced
              </span>
            </div>

            {/* URL Filter */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <div>
                <div className="text-xs font-semibold text-white">Delete URLs &amp; Invite Links</div>
                <div className="text-[11px] text-slate-400">
                  Deletes http/https, bare domains, t.me invites, and obfuscated dot links from regular members.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localConfig.deleteUrls}
                onChange={(e) => setLocalConfig({ ...localConfig, deleteUrls: e.target.checked })}
                aria-label="Toggle URL and Invite Link deletion"
                className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            {/* Phone Number Filter */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <div>
                <div className="text-xs font-semibold text-white">Delete Shared Phone Numbers</div>
                <div className="text-[11px] text-slate-400">
                  Deletes international, formatted, and spaced phone numbers to prevent solicitation and scams.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localConfig.deletePhoneNumbers}
                onChange={(e) => setLocalConfig({ ...localConfig, deletePhoneNumbers: e.target.checked })}
                aria-label="Toggle phone number deletion"
                className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            {/* Anti-Spam Filter */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <div>
                <div className="text-xs font-semibold text-white">Anti-Spam &amp; Rate Limiter</div>
                <div className="text-[11px] text-slate-400">
                  Enforces burst rate limiting and prevents repeated identical message flooding.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localConfig.antiSpamEnabled}
                onChange={(e) => setLocalConfig({ ...localConfig, antiSpamEnabled: e.target.checked })}
                aria-label="Toggle anti-spam and rate limiting"
                className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            {/* Tuning Sliders */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Burst Rate Limit:</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {localConfig.burstLimit} msgs in {localConfig.burstWindowSeconds}s
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={10}
                value={localConfig.burstLimit}
                onChange={(e) => setLocalConfig({ ...localConfig, burstLimit: Number(e.target.value) })}
                aria-label="Burst rate limit slider"
                className="w-full accent-cyan-500"
              />

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-slate-300 font-medium">Duplicate Repeat Limit:</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {localConfig.duplicateLimit} identical copies in {localConfig.duplicateWindowSeconds}s
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={6}
                value={localConfig.duplicateLimit}
                onChange={(e) => setLocalConfig({ ...localConfig, duplicateLimit: Number(e.target.value) })}
                aria-label="Duplicate message limit slider"
                className="w-full accent-cyan-500"
              />
            </div>

            {/* Action on Violation */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Action on Rule Violation:
              </label>
              <select
                value={localConfig.violationAction}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    violationAction: e.target.value as ModerationConfig['violationAction'],
                  })
                }
                aria-label="Action on rule violation"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="delete_and_warn">Delete &amp; Ephemeral 8s Warning (Recommended)</option>
                <option value="delete_only">Delete Message Silently</option>
                <option value="mute_15m">Delete &amp; Mute Member for 15 Minutes</option>
                <option value="mute_1h">Delete &amp; Mute Member for 1 Hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Column: Welcome Message & Admin Whitelist */}
        <div className="lg:col-span-6 space-y-4">
          {/* Welcome Message Editor */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                Customizable Welcome Message
              </h4>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Enabled:</span>
                <input
                  type="checkbox"
                  checked={localConfig.welcomeEnabled}
                  onChange={(e) => setLocalConfig({ ...localConfig, welcomeEnabled: e.target.checked })}
                  aria-label="Enable welcome message"
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Template (Supported: {'{mention}'}, {'{username}'}, {'{group_name}'}, {'{rules_link}'})
              </label>
              <textarea
                rows={5}
                value={localConfig.welcomeTemplate}
                onChange={(e) => setLocalConfig({ ...localConfig, welcomeTemplate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans leading-relaxed"
              />
            </div>

            {/* Live Preview */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                Live Rendered Greeting Preview
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                {welcomePreview}
              </div>
            </div>

            {/* Authorized Admin IDs Whitelist */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Authorized Telegram Admin IDs:</span>
                <span className="font-mono text-xs text-slate-400">ADMIN_IDS</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {localConfig.adminIds.map((id) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded font-mono text-xs bg-slate-900 border border-slate-800 text-cyan-300 flex items-center gap-1"
                  >
                    <span>ID: {id}</span>
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Only messages originating from these numeric Telegram user IDs will bypass links and have access to `/settings` or `/schedule`.
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-cyan-600/20 flex items-center space-x-2 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Apply &amp; Save Moderation Settings</span>
              </button>

              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in">
                  <Check className="w-4 h-4" />
                  Settings saved to backend!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
