'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Send,
  CheckCircle2,
  AlertCircle,
  Play,
  Copy,
  LogOut,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  Trash2,
} from 'lucide-react';

interface Account {
  _id: string;
  platform: string;
  handle: string;
  status: string;
}

interface RunRecord {
  _id: string;
  slot: string;
  status: string;
  itemsFound: number;
  itemsPassed: number;
  postsPublished: number;
  stages: Array<{ name: string; status: string }>;
  errorMessage?: string;
  createdAt: string;
}

interface JobRecord {
  _id: string;
  title: string;
  company: string;
  status: string;
  dropReason?: string;
  isLive: boolean;
  applyUrl: string;
  source: string;
}

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Authenticated state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'runs' | 'jobs'>('runs');
  const [triggering, setTriggering] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [copiedCron, setCopiedCron] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [telegramModalData, setTelegramModalData] = useState<{
    code: string;
    botUsername: string;
    instructions: string[];
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        setLoginError(data.error || 'Invalid password');
      }
    } catch {
      setLoginError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setPassword('');
  }

  async function loadDashboardData() {
    fetchAccounts();
    fetchRuns();
    fetchJobs();
  }

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/social/accounts');
      const data = await res.json();
      if (res.ok && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchRuns() {
    try {
      const res = await fetch('/api/runs');
      const data = await res.json();
      if (res.ok && Array.isArray(data.runs)) {
        setRuns(data.runs);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchJobs() {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setJobs(data.items);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function connectAccount(platform: string) {
    try {
      setConnectingPlatform(platform);
      const res = await fetch('/api/social/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          redirectUrl: window.location.origin + '/',
        }),
      });

      const data = await res.json();

      // Handle Telegram Bot verification code flow
      if (data.code && data.instructions) {
        setTelegramModalData({
          code: data.code,
          botUsername: data.botUsername || 'LateScheduleBot',
          instructions: data.instructions,
        });
        setShowAddAccountModal(false);
        return;
      }

      // Handle OAuth platforms (Instagram, YouTube, X)
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
        setShowAddAccountModal(false);
        // Refresh accounts list after user returns
        setTimeout(() => fetchAccounts(), 6000);
      } else {
        alert(data.error || 'Failed to get auth URL from Zernio');
      }
    } catch (err: any) {
      alert('Error connecting platform: ' + err.message);
    } finally {
      setConnectingPlatform(null);
    }
  }

  async function disconnectAccount(accountId: string) {
    if (!confirm('Disconnect this account from Zernio?')) return;
    try {
      const res = await fetch(`/api/social/accounts/${accountId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAccounts();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function triggerManualRun() {
    setTriggering(true);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: 'manual_run' }),
      });
      const data = await res.json();
      alert('Pipeline triggered! ' + (data.message || ''));
      fetchRuns();
    } catch (e: any) {
      alert('Failed to trigger run: ' + e.message);
    } finally {
      setTriggering(false);
    }
  }

  const cronUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/run?slot=morning&secret=YOUR_CRON_SECRET`
    : '/api/run?slot=morning&secret=YOUR_CRON_SECRET';

  function copyCronEndpoint() {
    navigator.clipboard.writeText(cronUrl);
    setCopiedCron(true);
    setTimeout(() => setCopiedCron(false), 2500);
  }

  // -------------------------------------------------------------------------
  // 1. LOADING SCREEN
  // -------------------------------------------------------------------------
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. UNLOGGED VIEW: ONLY ONE INPUT BOX (PASSWORD)
  // -------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#090D16]">
        <div className="w-full max-w-sm bg-[#111827] border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex w-12 h-12 rounded-xl bg-blue-600 items-center justify-center font-black text-white text-2xl mb-3 shadow-lg shadow-blue-600/30">
              ⚡
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Social Engine</h1>
            <p className="text-xs text-slate-400 mt-1">Enter your password to unlock the engine</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs text-center flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                placeholder="Password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#090D16] border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-4 top-3.5 pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm text-white transition shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Unlock Engine'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 3. AUTHENTICATED VIEW: ZERNIO CONNECT & AUTOMATION CONTROL
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#090D16] flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base">
              ⚡
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white">Social Engine</span>
              <span className="text-[10px] text-blue-400 bg-blue-950/60 border border-blue-800 px-2 py-0.5 rounded-full ml-2">
                Zernio Active
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={triggerManualRun}
              disabled={triggering}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{triggering ? 'Starting...' : 'Run Pipeline Now'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-6">

        {/* ---------------------------------------------------------------- */}
        {/* ZERNIO ACCOUNTS SECTION */}
        {/* Requirement: "if it already [connected] no need to show this option" */}
        {/* ---------------------------------------------------------------- */}
        {accounts.length === 0 ? (
          <div className="bg-[#111827] border border-blue-900/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-400" />
                  Connect Social Accounts via Zernio
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Connect your accounts to start automated publishing:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {['telegram', 'instagram', 'youtube', 'x'].map((plat) => (
                <button
                  key={plat}
                  onClick={() => connectAccount(plat)}
                  disabled={connectingPlatform === plat}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-700 bg-[#090D16] hover:bg-slate-800 text-xs font-semibold text-slate-200 capitalize transition"
                >
                  <PlusCircle className="w-4 h-4 text-blue-400" />
                  <span>{connectingPlatform === plat ? 'Connecting...' : `Connect ${plat}`}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Connected Accounts:</span>
              {accounts.map((acc) => (
                <div
                  key={acc._id}
                  className="flex items-center gap-1.5 bg-[#090D16] border border-slate-700 px-3 py-1 rounded-full text-xs text-slate-200"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="capitalize font-semibold">{acc.platform}</span>
                  <span className="text-slate-500">({acc.handle})</span>
                  <button
                    onClick={() => disconnectAccount(acc._id)}
                    className="ml-1 text-slate-500 hover:text-red-400"
                    title="Disconnect"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowAddAccountModal(true)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 self-start sm:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Connect Another</span>
            </button>
          </div>
        )}

        {/* Telegram Connect Instructions Modal */}
        {telegramModalData && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-[#111827] border border-blue-800 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-400" />
                  Connect Telegram Channel via @{telegramModalData.botUsername}
                </h3>
              </div>

              <div className="bg-[#090D16] border border-slate-800 p-4 rounded-xl space-y-2">
                <span className="text-xs text-slate-400">Your Verification Code:</span>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg">
                  <code className="text-sm font-mono text-emerald-400 font-bold">{telegramModalData.code}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(telegramModalData.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded transition"
                  >
                    {copiedCode ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300">Instructions:</span>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
                  {telegramModalData.instructions.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <a
                  href={`https://t.me/${telegramModalData.botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white text-center transition"
                >
                  Open @{telegramModalData.botUsername} in Telegram
                </a>
                <button
                  onClick={() => {
                    setTelegramModalData(null);
                    fetchAccounts();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for connecting more platforms */}
        {showAddAccountModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
              <h3 className="font-bold text-base text-white">Connect Platform Account</h3>
              <p className="text-xs text-slate-400">Choose a platform to authenticate via Zernio OAuth:</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {['telegram', 'instagram', 'youtube', 'x'].map((plat) => (
                  <button
                    key={plat}
                    onClick={() => connectAccount(plat)}
                    disabled={connectingPlatform === plat}
                    className="p-3 rounded-xl border border-slate-700 bg-[#090D16] hover:bg-slate-800 text-xs font-semibold capitalize transition flex items-center justify-center gap-2"
                  >
                    <span>{connectingPlatform === plat ? '...' : plat}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="w-full py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* EXTERNAL CRON TRIGGER CARD */}
        {/* Requirement: "add cron job from out side, only have to make api endpoint" */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              External Cron Trigger Endpoint
            </h2>
            <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
              Instant 200 OK Response
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Configure this URL in <b>cron-job.org</b> or GitHub Actions to run on your schedule. It sends an instant response and runs the pipeline in the background:
          </p>

          <div className="flex items-center gap-2 bg-[#090D16] border border-slate-800 rounded-lg p-2.5">
            <code className="text-xs text-blue-300 font-mono flex-1 overflow-x-auto truncate">
              {cronUrl}
            </code>
            <button
              onClick={copyCronEndpoint}
              className="flex items-center gap-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedCron ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* DASHBOARD TABS: RUNS & JOBS */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('runs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'runs'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white bg-slate-800/40'
              }`}
            >
              Pipeline Runs ({runs.length})
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'jobs'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white bg-slate-800/40'
              }`}
            >
              Jobs Audit Ledger ({jobs.length})
            </button>
          </div>

          <button
            onClick={() => {
              fetchRuns();
              fetchJobs();
            }}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* RUNS TABLE */}
        {activeTab === 'runs' && (
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090D16] text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Slot</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Stages</th>
                    <th className="py-3 px-4">Items (Found / Passed)</th>
                    <th className="py-3 px-4">Posts</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {runs.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono font-medium text-blue-300">{r.slot}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'completed'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : r.status === 'failed'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : r.status === 'running'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800 animate-pulse'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {(r.stages || []).map((s, idx) => (
                            <span
                              key={idx}
                              title={`${s.name}: ${s.status}`}
                              className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold ${
                                s.status === 'completed'
                                  ? 'bg-emerald-900/60 text-emerald-300'
                                  : s.status === 'failed'
                                  ? 'bg-red-900/60 text-red-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {r.itemsFound} / <span className="text-emerald-400 font-bold">{r.itemsPassed}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-purple-400">{r.postsPublished}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}

                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No runs recorded yet. Click "Run Pipeline Now" to trigger your first run.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* JOBS AUDIT TABLE */}
        {activeTab === 'jobs' && (
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090D16] text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Company & Role</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Drop Reason</th>
                    <th className="py-3 px-4">Apply URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {jobs.map((j) => (
                    <tr key={j._id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <span className="font-bold text-white">{j.company}</span> - {j.title}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{j.source}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            j.status === 'passed'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-amber-950 text-amber-400'
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{j.dropReason || 'Passed quality filter'}</td>
                      <td className="py-3 px-4">
                        <a
                          href={j.applyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                        >
                          <span>Open Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}

                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No collected jobs in ledger yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

