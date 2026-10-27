import React, { useState } from 'react';
import {
  Search,
  CheckCircle,
  XCircle,
  Shield,
  Phone,
  Link as LinkIcon,
  Zap,
  Lock,
  Eye,
  Terminal,
} from 'lucide-react';
import {
  ModerationConfig,
  containsUrl,
  containsPhoneNumber,
  evaluateMessageTS,
  maskPhoneNumberTS,
  maskSecretTS,
} from '../lib/moderation';

interface ModerationLabProps {
  config: ModerationConfig;
}

export const ModerationLab: React.FC<ModerationLabProps> = ({ config }) => {
  const [testInput, setTestInput] = useState(
    'Claim 5,000 $TURBO reward immediately at https://turbonex-airdrop.xyz/claim or call +1 555 234 5678!'
  );
  const [testUserId, setTestUserId] = useState(12345);
  const [isTestAdmin, setIsTestAdmin] = useState(false);

  const sampleLibrary = [
    {
      title: 'Crypto Phishing URL',
      text: '🔥 Free airdrop today! Check https://turbonex-bonus.xyz/claim before it ends!',
    },
    {
      title: 'Telegram Private Invite',
      text: 'Join our exclusive VIP pump group: t.me/+SecretVIP123',
    },
    {
      title: 'Obfuscated Dot Domain',
      text: 'Go to turbonex [dot] com for instant rewards',
    },
    {
      title: 'International Phone Number',
      text: 'Reach out to our customer rep on WhatsApp: +44 7911 123456',
    },
    {
      title: 'US Formatted Number',
      text: 'Direct hotline is (555) 839-2041, call 24/7',
    },
    {
      title: 'Spaced Scam Phone',
      text: 'Call my direct line: 9 8 7 6 5 4 3 2 1 0',
    },
    {
      title: 'Safe: Date & Price (Non-Phone)',
      text: 'Release scheduled for 2026-10-27. Total subscription cost is $49.99.',
    },
    {
      title: 'Safe: Community Discussion',
      text: 'I really love the clean speed and architecture of TurboNex community bot!',
    },
  ];

  const urlAnalysis = containsUrl(testInput);
  const phoneAnalysis = containsPhoneNumber(testInput);
  const decision = evaluateMessageTS(testInput, testUserId, isTestAdmin, config);

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="p-4 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-semibold mb-1">
            <Terminal className="w-5 h-5" />
            <span>Interactive Filter Testing Laboratory</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Test any arbitrary string against TurboNex's link, phone number, and anti-spam detection algorithms in real time.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 px-2">Simulate Role:</span>
          <button
            onClick={() => setIsTestAdmin(false)}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              !isTestAdmin
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Regular Member
          </button>
          <button
            onClick={() => setIsTestAdmin(true)}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              isTestAdmin
                ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Admin (Bypass)
          </button>
        </div>
      </div>

      {/* Main Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input and Sample Library */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Message Text to Test
            </label>
            <textarea
              rows={4}
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Paste or type any message containing links, numbers, or text..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 leading-relaxed font-sans"
            />

            {/* Quick Sample Selector */}
            <div className="mt-4">
              <span className="text-xs font-medium text-slate-400 block mb-2">
                Or pick a preset edge case:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sampleLibrary.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTestInput(sample.text)}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition-colors group"
                  >
                    <div className="text-xs font-semibold text-slate-300 group-hover:text-cyan-400">
                      {sample.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                      {sample.text}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Real-time Diagnostics & Verdict */}
        <div className="lg:col-span-5 space-y-4">
          {/* Final Verdict Card */}
          <div
            className={`p-5 rounded-2xl border shadow-xl transition-all ${
              decision.shouldDelete
                ? 'bg-rose-950/20 border-rose-800/50 text-rose-200'
                : 'bg-emerald-950/20 border-emerald-800/50 text-emerald-200'
            }`}
          >
            <div className="flex items-center space-x-3 mb-2">
              {decision.shouldDelete ? (
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <XCircle className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                  Moderation Verdict
                </span>
                <h4 className="text-lg font-bold text-white">
                  {decision.shouldDelete ? 'DELETE MESSAGE' : 'ALLOW MESSAGE'}
                </h4>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-2 font-medium">
              Reason: {decision.reason}
            </p>
            {decision.penaltyAction !== 'none' && (
              <div className="mt-2 text-xs font-mono bg-slate-950/80 px-2.5 py-1 rounded inline-block border border-slate-800">
                Action: {decision.penaltyAction}
              </div>
            )}
          </div>

          {/* Detailed Filter Inspections */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Engine Breakdown
            </h5>

            {/* URL Check */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
                  URL &amp; Invite Detection
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    urlAnalysis.hasUrl
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {urlAnalysis.hasUrl ? 'MATCH DETECTED' : 'CLEAN'}
                </span>
              </div>
              {urlAnalysis.hasUrl && (
                <div className="text-[11px] font-mono text-cyan-300 break-all pt-1">
                  {urlAnalysis.matchSnippet}
                </div>
              )}
            </div>

            {/* Phone Check */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-orange-400" />
                  Phone Number Detection
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    phoneAnalysis.hasPhone
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {phoneAnalysis.hasPhone ? 'MATCH DETECTED' : 'CLEAN'}
                </span>
              </div>
              {phoneAnalysis.hasPhone && (
                <div className="pt-1 space-y-1 text-[11px] font-mono">
                  <div className="text-orange-300 break-all">
                    Extracted: {phoneAnalysis.matchSnippet}
                  </div>
                  <div className="text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    Masked for logs: {maskPhoneNumberTS(phoneAnalysis.matchSnippet)}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Authorization Status */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                Admin Privilege Bypass
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isTestAdmin
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isTestAdmin ? 'ACTIVE (BYPASS)' : 'INACTIVE'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
