import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChatSimulator } from './components/ChatSimulator';
import { ModerationLab } from './components/ModerationLab';
import { SchedulerView } from './components/SchedulerView';
import { AdminSettings } from './components/AdminSettings';
import { CodeDeployment } from './components/CodeDeployment';
import { TestRunnerModal } from './components/TestRunnerModal';
import { DEFAULT_CONFIG, ModerationConfig, SpamTrackerTS } from './lib/moderation';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('simulator');
  const [config, setConfig] = useState<ModerationConfig>(DEFAULT_CONFIG);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [pythonTestResult, setPythonTestResult] = useState<{
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

  const runPythonTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/run-python-tests', { method: 'POST' });
      const data = await res.json();
      setPythonTestResult(data);
    } catch (err: any) {
      setPythonTestResult({
        success: false,
        output: err.message || 'Failed to reach Python test execution server.',
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  useEffect(() => {
    runPythonTests();
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
        pythonTestPassed={pythonTestResult?.success ?? null}
        onRunTests={() => setIsTestModalOpen(true)}
        isRunningTests={isRunningTests}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        TurboNex Community Moderation Bot • Built with Python 3.10 &amp; Telegram Bot API • Zero-Leak Security Architecture
      </footer>

      <TestRunnerModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onRunLiveTests={runPythonTests}
        pythonTestResult={pythonTestResult}
        isRunning={isRunningTests}
      />
    </div>
  );
}
