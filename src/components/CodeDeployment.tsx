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
  Database,
  Cloud,
  Clock,
} from 'lucide-react';

interface WorkerFile {
  name: string;
  path: string;
  content: string;
  size: number;
}

export const CodeDeployment: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'deploy' | 'code' | 'security'>('deploy');
  const [files, setFiles] = useState<WorkerFile[]>([]);
  const [selectedFileName, setSelectedFileName] = useState('index.ts');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Security interactive masker
  const [sampleToken, setSampleToken] = useState('7182938472:AAElskdfj-XYZ1234567890');

  useEffect(() => {
    fetch('/api/worker-files')
      .then((res) => res.json() as Promise<any>)
      .then((data: any) => {
        if (data.success && data.files) {
          setFiles(data.files);
        }
      })
      .catch((err) => console.error('Failed to fetch worker files:', err));
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const selectedFile = files.find((f) => f.name === selectedFileName) || files[0];

  const maskDemoToken = (tok: string) => {
    if (!tok) return '[NOT CONFIGURED]';
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
            🚀 Cloudflare Workers Free Deployment Guide
          </button>
          <button
            onClick={() => setActiveSubTab('code')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeSubTab === 'code'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📄 Worker Source Files &amp; D1 Schema
          </button>
          <button
            onClick={() => setActiveSubTab('security')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeSubTab === 'security'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔒 Secrets &amp; Cloudflare Free Tier Specs
          </button>
        </div>
      </div>

      {/* TAB 1: CLOUDFLARE WORKERS FREE DEPLOYMENT GUIDE */}
      {activeSubTab === 'deploy' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-cyan-400" />
              Complete Step-by-Step Deployment: Cloudflare Workers Free Plan
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              This setup runs 100% on Cloudflare's Free Tier (100,000 requests/day, 5,000,000 D1 reads/day, Cron Triggers). Zero persistent server or VPS required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  1
                </span>
                <h4 className="font-semibold text-white text-sm">BotFather &amp; Telegram Permissions</h4>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>
                  Message <span className="text-cyan-400 font-mono font-semibold">@BotFather</span> &rarr; send <code>/newbot</code>.
                </li>
                <li>Save the provided Bot Token (keep it secret!).</li>
                <li>
                  <strong>Disable Privacy Mode:</strong> Send <code>/setprivacy</code> &rarr; choose your bot &rarr; select <strong className="text-emerald-400">Disable</strong> (required to see group messages).
                </li>
                <li>
                  Add the bot to your community group and promote to <strong>Admin</strong> with <span className="text-cyan-300 font-medium">Delete messages</span> and <span className="text-cyan-300 font-medium">Ban users</span> permissions.
                </li>
                <li>
                  Add the bot to your channel and promote to <strong>Admin</strong> with <span className="text-cyan-300 font-medium">Post messages</span> permission.
                </li>
              </ul>
            </div>

            {/* Step 2 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  2
                </span>
                <h4 className="font-semibold text-white text-sm">Create Cloudflare D1 Database</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log into Cloudflare and create your serverless SQLite D1 database:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 space-y-2">
                <div className="text-slate-400"># Log into Cloudflare</div>
                <div>npx wrangler login</div>
                <div className="text-slate-400 pt-1"># Create D1 database for settings &amp; scheduler</div>
                <div>npx wrangler d1 create turbonex-db</div>
              </div>
              <p className="text-[11px] text-slate-400">
                Copy the output <code>database_id</code> into your <code>wrangler.toml</code> file under <code>database_id</code>.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  3
                </span>
                <h4 className="font-semibold text-white text-sm">Execute Database Migrations</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Apply the initial schema to your remote Cloudflare D1 database:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 space-y-1">
                <div>npx wrangler d1 execute turbonex-db --remote --file=migrations/0001_init.sql</div>
              </div>
              <p className="text-[11px] text-slate-400">
                This creates the tables for settings, scheduled channel posts, spam tracking, and moderation audit logs.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  4
                </span>
                <h4 className="font-semibold text-white text-sm">Configure Encrypted Cloudflare Secrets</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Set environment secrets securely in Cloudflare (never commit these to git):
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 space-y-1">
                <div>npx wrangler secret put TELEGRAM_BOT_TOKEN</div>
                <div>npx wrangler secret put TELEGRAM_SECRET_TOKEN</div>
                <div>npx wrangler secret put ADMIN_API_KEY</div>
                <div>npx wrangler secret put ADMIN_IDS</div>
                <div>npx wrangler secret put LINKED_CHANNEL_ID</div>
              </div>
              <p className="text-[11px] text-slate-400">
                <code>TELEGRAM_SECRET_TOKEN</code> authenticates Telegram webhooks, while <code>ADMIN_API_KEY</code> authenticates dashboard management APIs.
              </p>
            </div>

            {/* Step 5 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  5
                </span>
                <h4 className="font-semibold text-white text-sm">Build SPA &amp; Deploy Worker to Cloudflare Edge</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Compile the frontend dashboard assets and deploy Worker + Static Assets:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 space-y-1">
                <div className="text-slate-400"># 1. Compile React SPA into ./dist</div>
                <div>npm run build</div>
                <div className="text-slate-400 pt-1"># 2. Deploy Worker and Static Assets</div>
                <div>npx wrangler deploy</div>
              </div>
              <p className="text-[11px] text-slate-400">
                Wrangler will output your live URL: <code>https://turbonex-moderation-bot.&lt;subdomain&gt;.workers.dev</code>
              </p>
            </div>

            {/* Step 6 */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                  6
                </span>
                <h4 className="font-semibold text-white text-sm">Register Telegram Webhook</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Register your Cloudflare Worker URL with Telegram with your secret token:
              </p>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 break-all space-y-1">
                <div>curl -F "url=https://your-worker.workers.dev/webhook" \</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-F "secret_token=YOUR_TELEGRAM_SECRET_TOKEN" \</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook</div>
              </div>
              <p className="text-[11px] text-slate-400">
                Or simply paste your worker URL in the <strong>Webhook Gateway</strong> tab of this dashboard!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORKER SOURCE CODE EXPLORER */}
      {activeSubTab === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File List */}
          <div className="lg:col-span-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Cloudflare Worker Files ({files.length})
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
                <span>{selectedFile ? selectedFile.path : ''}</span>
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
              <span>Cloudflare Workers Free Plan Architecture &amp; Zero-Leak Security</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Cloudflare Workers runs on an edge isolate runtime. Secrets are injected at runtime via environment bindings (<code className="text-cyan-300">env.TELEGRAM_BOT_TOKEN</code>), never exposed in client bundles or public repositories.
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

            {/* Cloudflare Free Tier Specifications */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Cloud className="w-4 h-4 text-cyan-400" />
                Cloudflare Free Tier Capacity
              </h4>
              <ul className="text-xs text-slate-300 space-y-2.5">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>100,000 Inbound Requests / Day:</strong> More than enough for high-traffic active Telegram communities.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>5 Million D1 Database Reads / Day:</strong> Fast persistent storage for settings, anti-spam logs, and scheduled posts.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Cron Triggers (1-minute resolution):</strong> Cloudflare Free plan allows crons running every minute (<code>* * * * *</code>), ideal for checking pending channel posts.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero Cold Starts:</strong> Workers V8 isolates start in under 5 milliseconds across global edge locations.
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
