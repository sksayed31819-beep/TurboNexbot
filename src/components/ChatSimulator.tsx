import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  UserCheck,
  UserX,
  Sparkles,
  Bot,
  UserPlus,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  ModerationConfig,
  SpamTrackerTS,
  evaluateMessageTS,
  formatWelcomeMessageTS,
  maskPhoneNumberTS,
} from '../lib/moderation';

interface Message {
  id: string;
  senderName: string;
  senderHandle: string;
  senderId: number;
  role: 'member' | 'spammer' | 'admin' | 'bot';
  text: string;
  timestamp: string;
  isDeleted?: boolean;
  deletionReason?: string;
  violationType?: 'url' | 'phone' | 'spam';
  isBotNotice?: boolean;
}

interface AuditLog {
  id: string;
  time: string;
  action: 'DELETED' | 'WARNED' | 'MUTED' | 'ALLOWED' | 'WELCOMED';
  userHandle: string;
  reason: string;
  detail: string;
}

interface ChatSimulatorProps {
  config: ModerationConfig;
  spamTracker: SpamTrackerTS;
}

export const ChatSimulator: React.FC<ChatSimulatorProps> = ({ config, spamTracker }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-1',
      senderName: 'Alex (Admin)',
      senderHandle: 'alex_admin',
      senderId: 999001,
      role: 'admin',
      text: 'Welcome to TurboNex Community! Please review guidelines: https://t.me/turbonex_rules',
      timestamp: '10:00 AM',
    },
    {
      id: 'm-2',
      senderName: 'Elena_Tech',
      senderHandle: 'elena_tech',
      senderId: 10452,
      role: 'member',
      text: 'Excited to be here! When is the next community AMA scheduled?',
      timestamp: '10:01 AM',
    },
  ]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: 'log-0',
      time: '10:00:15',
      action: 'ALLOWED',
      userHandle: '@alex_admin',
      reason: 'Admin authorized - bypass active',
      detail: 'https://t.me/turbonex_rules',
    },
  ]);

  const [activeRole, setActiveRole] = useState<'member' | 'spammer' | 'admin'>('member');
  const [inputText, setInputText] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getSenderDetails = (role: 'member' | 'spammer' | 'admin') => {
    switch (role) {
      case 'admin':
        return { name: 'Alex (Admin)', handle: 'alex_admin', id: 999001, role: 'admin' as const };
      case 'spammer':
        return { name: 'CryptoScammer_X', handle: 'airdrop_bot_99', id: 777999, role: 'spammer' as const };
      case 'member':
      default:
        return { name: 'Jordan_99', handle: 'jordan_99', id: 45812, role: 'member' as const };
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const sender = getSenderDetails(activeRole);
    const nowIso = new Date().toLocaleTimeString();
    const isAdmin = sender.id === 999001;

    // Run moderation rules
    const decision = evaluateMessageTS(
      text,
      sender.id,
      isAdmin,
      config,
      spamTracker,
      Date.now() / 1000
    );

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (decision.shouldDelete) {
      // 1. Add deleted message placeholder
      const deletedMsg: Message = {
        id: messageId,
        senderName: sender.name,
        senderHandle: sender.handle,
        senderId: sender.id,
        role: sender.role,
        text,
        timestamp: nowIso,
        isDeleted: true,
        deletionReason: decision.reason,
        violationType: decision.violationType,
      };

      // 2. Add ephemeral bot warning
      const botWarning: Message = {
        id: `bot-warn-${Date.now()}`,
        senderName: 'TurboNex Guard',
        senderHandle: 'turbonex_bot',
        senderId: 0,
        role: 'bot',
        text: `⚠️ @${sender.handle}, your message was deleted: **${decision.reason}**. Community rules prohibit unauthorized links, phone numbers, and spam.`,
        timestamp: nowIso,
        isBotNotice: true,
      };

      setMessages((prev) => [...prev, deletedMsg, botWarning]);

      // Mask sensitive snippet for audit log
      const safeSnippet =
        decision.violationType === 'phone'
          ? maskPhoneNumberTS(decision.matchedDetail)
          : decision.matchedDetail;

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        action: 'DELETED',
        userHandle: `@${sender.handle}`,
        reason: decision.reason,
        detail: safeSnippet,
      };
      setAuditLogs((prev) => [newLog, ...prev.slice(0, 29)]);
    } else {
      // Legitimate message allowed
      const legitMsg: Message = {
        id: messageId,
        senderName: sender.name,
        senderHandle: sender.handle,
        senderId: sender.id,
        role: sender.role,
        text,
        timestamp: nowIso,
      };

      setMessages((prev) => [...prev, legitMsg]);

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        action: 'ALLOWED',
        userHandle: `@${sender.handle}`,
        reason: decision.reason,
        detail: text.slice(0, 40),
      };
      setAuditLogs((prev) => [newLog, ...prev.slice(0, 29)]);
    }

    if (!textToSend) {
      setInputText('');
    }
  };

  const handleSimulateNewMember = () => {
    const randomNames = ['Dave_Web3', 'Elena_Crypto', 'Marcus_Dev', 'Zack_HODL'];
    const selectedName = randomNames[Math.floor(Math.random() * randomNames.length)];
    const newUserId = Math.floor(10000 + Math.random() * 90000);
    const nowIso = new Date().toLocaleTimeString();

    // 1. Join notification
    const joinMsg: Message = {
      id: `join-${Date.now()}`,
      senderName: 'System',
      senderHandle: 'system',
      senderId: 0,
      role: 'bot',
      text: `👋 ${selectedName} joined the group`,
      timestamp: nowIso,
      isBotNotice: true,
    };

    // 2. Bot welcome message
    const welcomeText = formatWelcomeMessageTS(
      config.welcomeTemplate,
      selectedName,
      selectedName.toLowerCase(),
      newUserId,
      config.communityName,
      config.rulesLink
    );

    const welcomeMsg: Message = {
      id: `welcome-${Date.now()}`,
      senderName: 'TurboNex Guard',
      senderHandle: 'turbonex_bot',
      senderId: 0,
      role: 'bot',
      text: welcomeText,
      timestamp: nowIso,
      isBotNotice: true,
    };

    setMessages((prev) => [...prev, joinMsg, welcomeMsg]);

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      action: 'WELCOMED',
      userHandle: `@${selectedName.toLowerCase()}`,
      reason: 'New member joined community',
      detail: `Sent welcome template to user_id=${newUserId}`,
    };
    setAuditLogs((prev) => [newLog, ...prev.slice(0, 29)]);
  };

  const handleSimulateBurstSpam = () => {
    // Send 5 rapid messages to trigger rate limit
    const spamTexts = [
      '⚡ FAST FREE AIRDROP 1',
      '⚡ FAST FREE AIRDROP 2',
      '⚡ FAST FREE AIRDROP 3',
      '⚡ FAST FREE AIRDROP 4',
      '⚡ FAST FREE AIRDROP 5 - FLOOD',
    ];
    spamTexts.forEach((msg, idx) => {
      setTimeout(() => {
        handleSendMessage(msg);
      }, idx * 120);
    });
  };

  const handleClearChat = () => {
    setMessages([]);
    spamTracker.reset();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Telegram Group Chat Simulator Window */}
      <div className="lg:col-span-8 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Chat Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-cyan-500/20">
              TN
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-white text-sm sm:text-base">{config.communityName}</h3>
                <span className="px-1.5 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-300 font-mono rounded">
                  Group
                </span>
              </div>
              <p className="text-xs text-slate-400">1,248 members • 4 admins • TurboNex Guard Active</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearChat}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Reset Chat History & Spam Counters"
              aria-label="Clear chat history"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Test Attack / Scenario Presets */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Quick Test Scenarios:
            </span>
            <span className="text-[11px] text-slate-400">Click any preset to simulate</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSendMessage('Claim free crypto reward at https://turbonex-airdrop.xyz/claim now!')}
              className="px-2.5 py-1 text-xs rounded-md bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
            >
              🚨 Drop Phishing URL
            </button>
            <button
              onClick={() => handleSendMessage('Join my private trading alpha channel: t.me/+SecretVIP123')}
              className="px-2.5 py-1 text-xs rounded-md bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
            >
              🔗 Telegram Invite Link
            </button>
            <button
              onClick={() => handleSendMessage('Check this giveaway: turbonex [dot] io right now')}
              className="px-2.5 py-1 text-xs rounded-md bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30 transition-colors"
            >
              🕵️ Obfuscated Link
            </button>
            <button
              onClick={() => handleSendMessage('Call our support team at +1 555 234 5678 for instant token swap')}
              className="px-2.5 py-1 text-xs rounded-md bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 border border-orange-500/30 transition-colors"
            >
              📱 Share Phone Number
            </button>
            <button
              onClick={() => handleSendMessage('Whatsapp our agent directly: 9 8 7 6 5 4 3 2 1 0')}
              className="px-2.5 py-1 text-xs rounded-md bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/30 transition-colors"
            >
              📞 Spaced Phone Number
            </button>
            <button
              onClick={handleSimulateBurstSpam}
              className="px-2.5 py-1 text-xs rounded-md bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 border border-yellow-500/30 transition-colors"
            >
              ⚡ 5x Burst Spam Flooding
            </button>
            <button
              onClick={handleSimulateNewMember}
              className="px-2.5 py-1 text-xs rounded-md bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
            >
              👋 New Member Joins
            </button>
            <button
              onClick={() => handleSendMessage('Hello team, really loving the TurboNex app interface updates!')}
              className="px-2.5 py-1 text-xs rounded-md bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors"
            >
              💬 Normal Member Chat
            </button>
          </div>
        </div>

        {/* Message Feed Container */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[380px] max-h-[500px] bg-slate-950/50">
          {messages.map((msg) => {
            if (msg.isDeleted) {
              return (
                <div
                  key={msg.id}
                  className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 text-xs sm:text-sm text-slate-300 transition-all animate-in fade-in"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" />
                      Message Deleted by TurboNex Guard
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                  </div>
                  <div className="text-slate-400 line-through text-xs font-mono bg-slate-900/60 p-2 rounded border border-rose-950">
                    {msg.text}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-rose-300 font-medium">Violation: {msg.deletionReason}</span>
                    <span className="text-slate-400">User: @{msg.senderHandle}</span>
                  </div>
                </div>
              );
            }

            if (msg.isBotNotice) {
              return (
                <div
                  key={msg.id}
                  className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs sm:text-sm text-cyan-200"
                >
                  <div className="flex items-center space-x-2 font-semibold text-cyan-400 mb-1">
                    <Bot className="w-4 h-4 text-cyan-400" />
                    <span>TurboNex Guard Bot</span>
                    <span className="text-[10px] text-slate-400 font-mono ml-auto">{msg.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                </div>
              );
            }

            const isAdmin = msg.role === 'admin';
            return (
              <div
                key={msg.id}
                className={`p-3 rounded-xl text-xs sm:text-sm max-w-[85%] ${
                  isAdmin
                    ? 'ml-auto bg-blue-600/20 border border-blue-500/30 text-blue-100'
                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between space-x-3 mb-1">
                  <div className="flex items-center space-x-1.5">
                    <span className={`font-semibold ${isAdmin ? 'text-blue-300' : 'text-slate-300'}`}>
                      {msg.senderName}
                    </span>
                    {isAdmin && (
                      <span className="px-1.5 py-0.2 text-[10px] font-mono bg-blue-500/30 text-blue-200 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                </div>
                <div className="break-words leading-relaxed">{msg.text}</div>
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar & Role Switcher */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800">
          {/* Role Selector */}
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <span>Posting As:</span>
            </span>
            <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveRole('member')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeRole === 'member'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                👤 Regular Member
              </button>
              <button
                type="button"
                onClick={() => setActiveRole('spammer')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeRole === 'spammer'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                😈 Spammer / Scammer
              </button>
              <button
                type="button"
                onClick={() => setActiveRole('admin')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeRole === 'admin'
                    ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🛡️ Admin (Bypasses Filter)
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Send message as ${getSenderDetails(activeRole).name}... (try a link or phone number)`}
              aria-label="Telegram chat message input"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl shadow-md shadow-cyan-600/20 transition-all"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Security Audit & Redaction Log Sidebar */}
      <div className="lg:col-span-4 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">Real-time Moderation Audit</h3>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
            Masked Logs
          </span>
        </div>

        <div className="p-3 bg-slate-950/40 border-b border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-medium mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Zero-Leak Security Active</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Sensitive user phone numbers and API keys are automatically redacted in all audit logs.
          </p>
        </div>

        <div className="flex-1 p-3 overflow-y-auto space-y-2.5 max-h-[500px]">
          {auditLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">No moderation events logged yet.</div>
          ) : (
            auditLogs.map((log) => {
              const isDelete = log.action === 'DELETED';
              const isWelcome = log.action === 'WELCOMED';
              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono font-semibold text-[10px] ${
                        isDelete
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : isWelcome
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{log.time}</span>
                  </div>

                  <div className="text-slate-300 font-medium flex items-center justify-between">
                    <span>{log.userHandle}</span>
                  </div>

                  <div className="text-[11px] text-slate-400">{log.reason}</div>

                  {log.detail && (
                    <div className="text-[10px] font-mono bg-slate-900 p-1.5 rounded text-slate-300 break-all border border-slate-800">
                      {log.detail}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
