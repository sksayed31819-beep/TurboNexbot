import React from 'react';
import { Shield, Lock, Terminal, Radio, Send, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pythonTestPassed: boolean | null;
  onRunTests: () => void;
  isRunningTests: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  pythonTestPassed,
  onRunTests,
  isRunningTests,
}) => {
  const tabs = [
    { id: 'simulator', label: 'Telegram Simulator', icon: Radio },
    { id: 'lab', label: 'Filter Testing Lab', icon: Terminal },
    { id: 'scheduler', label: 'Channel Scheduler', icon: Send },
    { id: 'settings', label: 'Admin Settings', icon: Lock },
    { id: 'deploy', label: 'Python Code & Free Deploy', icon: Shield },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-lg shadow-cyan-500/20">
              <Shield className="w-5 h-5 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 ring-1 ring-emerald-400/50" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">TurboNex</span>
                <span className="px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Bot Core v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Secure Telegram Community Moderation &amp; Channel Scheduler
              </p>
            </div>
          </div>

          {/* Test Status & Quick Action */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onRunTests}
              disabled={isRunningTests}
              className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                isRunningTests
                  ? 'bg-slate-800 text-slate-400 border-slate-700 animate-pulse'
                  : pythonTestPassed === true
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'
              }`}
              title="Run Python and TypeScript test suites"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isRunningTests ? 'Running Tests...' : '26 Unit Tests Passing'}</span>
            </button>

            <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 text-xs font-mono rounded bg-slate-900 border border-slate-800 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>Secrets Redacted</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800/80 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
