import React, { useState, useEffect } from 'react';
import {
  Code,
  Copy,
  Check,
  Server,
  ShieldCheck,
  Terminal,
  ExternalLink,
  Download,
  FileCode,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface BotFile {
  name: string;
  path: string;
  content: string;
  size: number;
}

export const CodeDeployment: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'deploy' | 'code' | 'security'>('deploy');
  const [files, setFiles] = useState<BotFile[]>([]);
  const [selectedFileName, setSelectedFileName] = useState('bot.py');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Security interactive masker
  const [sampleToken, setSampleToken] = useState('7182938472:AAElskdfj-XYZ1234567890');

  useEffect(() => {
    fetch('/api/bot-files')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.files) {
          setFiles(data.files);
        }
      })
      .catch((err) => console.error('Failed to fetch bot files:', err));
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const selectedFile = files.find((f) => f.name === selectedFileName) || files[0];

  const maskDemoToken = (tok: string) => {
    if (!tok) return '[NOT SET]';
    const c = tok.trim();
    if (c.length <= 8) return '***REDACTED***';
    return `${c.slice(0, 4)}***${c.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveSubTab('deploy')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeSubTab === 'deploy'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🚀 Free Hosting Deployment Guide
          </button>
          <button
            onClick={() => setActiveSubTab('code')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeSubTab === 'code'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📄 Python Codebase Viewer
          </button>
          <button
            onClick={() => setActiveSubTab('security')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeSubTab === 'security'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔒 Secrets &amp; Redaction Architecture
          </button>
        </div>
      </div>

      {/* TAB 1: FREE HOSTING DEPLOYMENT GUIDE */}
      {activeSubTab === 'deploy' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              Free Hosting on Render.com (Background Worker / Webhook)
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Render provides a free tier that runs Python background services and web apps with zero hosting costs. Follow this 4-step deployment guide to take your TurboNex moderation bot live.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  1
                </span>
                <h4 className="font-semibold text-white text-sm">Create Bot &amp; Admin Rights</h4>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>
                  Open Telegram and message{' '}
                  <span className="text-cyan-400 font-mono font-semibold">@BotFather</span>.
                </li>
                <li>Send `/newbot`, choose a name (`TurboNex Moderation Bot`) and username.</li>
                <li>
                  Copy your HTTP API Token (e.g. `7182938472:AAElskdfj...`).{' '}
                  <strong className="text-amber-300">Keep this secret!</strong>
                </li>
                <li>
                  Add the bot to your Telegram group and promote it to <strong>Admin</strong> with{' '}
                  <span className="text-emerald-400 font-medium">Delete Messages</span> and{' '}
                  <span className="text-emerald-400 font-medium">Ban/Restrict Users</span> rights.
                </li>
                <li>
                  Message <span className="text-cyan-400 font-mono">@userinfobot</span> to find your
                  numeric Telegram User ID.
                </li>
              </ul>
            </div>

            {/* Step 2 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  2
                </span>
                <h4 className="font-semibold text-white text-sm">Setup Render Free Service</h4>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>
                  Create a free account at{' '}
                  <a
                    href="https://render.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    Render.com <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Click <strong>New +</strong> &rarr; <strong>Background Worker</strong> (or Web Service).
                </li>
                <li>Connect your repository containing this `bot/` folder.</li>
                <li>
                  Set <strong>Build Command</strong>:
                  <div className="bg-slate-950 p-1.5 rounded font-mono text-[11px] text-cyan-300 border border-slate-800 my-1">
                    pip install -r bot/requirements.txt
                  </div>
                </li>
                <li>
                  Set <strong>Start Command</strong>:
                  <div className="bg-slate-950 p-1.5 rounded font-mono text-[11px] text-cyan-300 border border-slate-800 my-1">
                    python -u bot/bot.py
                  </div>
                </li>
              </ul>
            </div>

            {/* Step 3 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  3
                </span>
                <h4 className="font-semibold text-white text-sm">Configure Environment Secrets</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                In Render's <strong>Environment Variables</strong> tab, add these keys:
              </p>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-xs space-y-1 text-slate-300">
                <div><span className="text-cyan-400">TELEGRAM_BOT_TOKEN</span>=your_botfather_token</div>
                <div><span className="text-cyan-400">ADMIN_IDS</span>=987654321,123456789</div>
                <div><span className="text-cyan-400">CHANNEL_ID</span>=@turbonex_official</div>
                <div><span className="text-cyan-400">DELETE_URLS</span>=true</div>
                <div><span className="text-cyan-400">DELETE_PHONE_NUMBERS</span>=true</div>
                <div><span className="text-cyan-400">ANTI_SPAM_ENABLED</span>=true</div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  4
                </span>
                <h4 className="font-semibold text-white text-sm">Deploy &amp; Monitor Logs</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click <strong>Deploy</strong>. Render will install dependencies and start polling.
              </p>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 space-y-1">
                <div>[INFO] TurboNexBot: Bot token verified (loaded securely as 7182***2345)</div>
                <div>[INFO] TurboNexBot: Admin count: 1 authorized administrators</div>
                <div>[INFO] TurboNexBot: Started successfully in polling mode.</div>
              </div>
              <p className="text-[11px] text-slate-400">
                Notice that token secrets are automatically masked even in startup logs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PYTHON CODEBASE EXPLORER */}
      {activeSubTab === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File List */}
          <div className="lg:col-span-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Bot Source Files ({files.length})
            </h4>
            <div className="space-y-1 bg-slate-900 p-2 rounded-2xl border border-slate-800">
              {files.map((file) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFileName(file.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-colors text-left ${
                    selectedFileName === file.name
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{file.name}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                </button>
              ))}
            </div>
          </div>

          {/* File Content Preview */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 font-mono text-xs text-slate-300">
                <Code className="w-4 h-4 text-cyan-400" />
                <span>bot/{selectedFile ? selectedFile.name : ''}</span>
              </div>
              {selectedFile && (
                <button
                  onClick={() => handleCopy(selectedFile.content, selectedFile.name)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  {copiedKey === selectedFile.name ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy File</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex-1 p-4 bg-slate-950 overflow-x-auto max-h-[500px]">
              <pre className="font-mono text-xs text-slate-200 leading-relaxed whitespace-pre font-normal">
                {selectedFile ? selectedFile.content : 'Select a file to inspect...'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECRETS & REDACTION ARCHITECTURE */}
      {activeSubTab === 'security' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold mb-2">
              <ShieldCheck className="w-5 h-5" />
              <span>Zero-Leak Token &amp; Personal Data Redaction Architecture</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              TurboNex applies defensive logging and variable isolation at every layer. The bot never logs raw tokens or raw telephone numbers, eliminating token exposure in production monitoring.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Token Masker Interactive Demo */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                Live Secret Masker Simulation
              </h4>
              <p className="text-xs text-slate-400">
                Type or paste a sample Telegram Bot token to see how TurboNex masks it before logging:
              </p>
              <input
                type="text"
                value={sampleToken}
                onChange={(e) => setSampleToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Paste token format here..."
              />

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Sanitized Output in Logs:</div>
                <div className="font-mono text-xs text-emerald-400 font-bold break-all">
                  {maskDemoToken(sampleToken)}
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Security Verification Checklist
              </h4>
              <ul className="text-xs text-slate-300 space-y-2.5">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Environment-Only Secrets:</strong> `TELEGRAM_BOT_TOKEN` is loaded strictly via `os.getenv` without hardcoded fallbacks.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Phone Privacy Masking:</strong> User phone numbers are masked (`+1 (555) ***-**78`) before recording moderation audit events.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Strict Admin Guard:</strong> Non-admin users cannot execute `/settings`, `/toggle_links`, `/toggle_phones`, or `/schedule`.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Clean Git Tracking:</strong> `.env` is listed in `.gitignore` so secrets are never pushed to GitHub repositories.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
