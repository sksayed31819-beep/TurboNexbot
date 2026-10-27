import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { WebhookManager } from './components/WebhookManager';
import { ChatSimulator } from './components/ChatSimulator';
import { ModerationLab } from './components/ModerationLab';
import { SchedulerView } from './components/SchedulerView';
import { AdminSettings } from './components/AdminSettings';
import { CodeDeployment } from './components/CodeDeployment';
import { TestRunnerModal } from './components/TestRunnerModal';
import { DEFAULT_CONFIG, ModerationConfig, SpamTrackerTS } from './lib/moderation';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('webhook');
  const [config, setConfig] = useState<ModerationConfig>(DEFAULT_CONFIG);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [unitTestResult, setUnitTestResult] = useState<{
    success: boolean;
    output: string;
    durationMs?: number;
    timestamp?: string;
  } | null>(null);

  // Persistent anti-spam tracker instance
  const spamTrackerRef = useRef<SpamTrackerTS>(
    new SpamTrackerTS(
      config.burstLimit,
      config.burstWindowSeconds,
      config.duplicateLimit,
      config.duplicateWindowSeconds
    )
  );

  const runUnitTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/run-unit-tests', { method: 'POST' });
      const data = (await res.json()) as any;
      setUnitTestResult(data);
    } catch (err: any) {
      setUnitTestResult({
        success: false,
        output: err.message || 'Failed to reach unit test execution server.',
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  useEffect(() => {
    runUnitTests();
  }, []);

  const handleUpdateConfig = (newConfig: ModerationConfig) => {
    setConfig(newConfig);
    // Update tracker thresholds
    spamTrackerRef.current.burstLimit = newConfig.burstLimit;
    spamTrackerRef.current.burstWindowSeconds = newConfig.burstWindowSeconds;
    spamTrackerRef.current.duplicateLimit = newConfig.duplicateLimit;
    spamTrackerRef.current.duplicateWindowSeconds = newConfig.duplicateWindowSeconds;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unitTestsPassed={unitTestResult?.success ?? null}
        onRunTests={() => setIsTestModalOpen(true)}
        isRunningTests={isRunningTests}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'webhook' && <WebhookManager />}
        {activeTab === 'simulator' && (
          <ChatSimulator config={config} spamTracker={spamTrackerRef.current} />
        )}
        {activeTab === 'lab' && <ModerationLab config={config} />}
        {activeTab === 'scheduler' && <SchedulerView config={config} />}
        {activeTab === 'settings' && (
          <AdminSettings config={config} onUpdateConfig={handleUpdateConfig} />
        )}
        {activeTab === 'deploy' && <CodeDeployment />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        TurboNex Community Moderation Bot • Cloudflare Workers Free Plan Architecture (Edge Webhook &amp; D1 Database)
      </footer>

      <TestRunnerModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onRunLiveTests={runUnitTests}
        unitTestResult={unitTestResult}
        isRunning={isRunningTests}
      />
    </div>
  );
}
