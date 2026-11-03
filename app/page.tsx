'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock, Send, CheckCircle2, AlertCircle, Play, Copy, LogOut,
  RefreshCw, ExternalLink, PlusCircle, Trash2, Activity,
  BarChart2, Briefcase, Image, Zap, Settings, Globe, Eye,
  TrendingUp, Clock, DollarSign, ChevronDown, ChevronUp, Video,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Account { _id: string; platform: string; handle: string; status: string }
interface Stage { name: string; status: string; itemsIn?: number; itemsOut?: number; errorMessage?: string }
interface RunRecord {
  _id: string; slot: string; status: string; itemsFound: number;
  itemsPassed: number; postsPublished: number; stages: Stage[];
  errorMessage?: string; createdAt: string; startedAt?: string; completedAt?: string;
}
interface JobRecord {
  _id: string; title: string; company: string; status: string;
  dropReason?: string; isLive: boolean; applyUrl: string; source: string;
}
interface LlmCallRecord {
  _id: string; alias: string; prompt: string; response?: string;
  totalTokens?: number; estimatedCostUsd?: number; latencyMs?: number;
  success: boolean; errorMessage?: string; createdAt: string; runId?: string;
}
interface PostRecord {
  _id: string; platform: string; caption: string; status: string;
  postUrl?: string; createdAt: string; externalPostId?: string;
  metrics?: { likes: number; reach: number; comments: number; shares: number };
}
interface AnalyticsOverview {
  runsToday: number; runsTotal: number; postsTotal: number; jobsTotal: number;
  jobsPassed: number; assetsTotal: number; llmCalls: number; llmTokens: number;
  llmCostUsd: string; llmSuccessRate: number;
}

type Tab = 'overview' | 'runs' | 'jobs' | 'posts' | 'ai' | 'settings';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const statusColor = (s: string) =>
  s === 'completed' || s === 'published' || s === 'passed'
    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
    : s === 'failed'
    ? 'bg-red-950 text-red-400 border border-red-800'
    : s === 'running'
    ? 'bg-blue-950 text-blue-400 border border-blue-800 animate-pulse'
    : s === 'skipped'
    ? 'bg-amber-950 text-amber-400 border border-amber-800'
    : 'bg-slate-800 text-slate-400';

const platformEmoji: Record<string, string> = {
  telegram: '✈️', instagram: '📸', youtube: '▶️', x: '𝕏', twitter: '𝕏',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [llmCalls, setLlmCalls] = useState<LlmCallRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [platformBreakdown, setPlatformBreakdown] = useState<{ platform: string; count: number }[]>([]);

  // UI state
  const [triggering, setTriggering] = useState<null | 'image' | 'video' | 'all'>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [telegramModalData, setTelegramModalData] = useState<{ code: string; botUsername: string; instructions: string[] } | null>(null);
  const [copiedCron, setCopiedCron] = useState<null | 'image' | 'video' | 'all'>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedLlm, setExpandedLlm] = useState<string | null>(null);
  const [killSwitch, setKillSwitch] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    try {
      const r = await fetch('/api/auth/me');
      if (r.ok) { setIsAuthenticated(true); loadAll(); }
      else setIsAuthenticated(false);
    } catch { setIsAuthenticated(false); }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(''); setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (r.ok) { setIsAuthenticated(true); loadAll(); }
      else setLoginError(d.error || 'Invalid password');
    } catch { setLoginError('Failed to connect'); }
    finally { setLoading(false); }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false); setPassword('');
  }

  // ── Data fetchers ──────────────────────────────────────────────────────────
  const loadAll = useCallback(() => {
    fetchAccounts(); fetchRuns(); fetchJobs(); fetchLlm(); fetchPosts(); fetchAnalytics();
  }, []);

  async function fetchAccounts() {
    const r = await fetch('/api/social/accounts').catch(() => null);
    if (r?.ok) { const d = await r.json(); setAccounts(d.accounts || []); }
  }
  async function fetchRuns() {
    const r = await fetch('/api/runs').catch(() => null);
    if (r?.ok) { const d = await r.json(); setRuns(d.runs || []); }
  }
  async function fetchJobs() {
    const r = await fetch('/api/jobs').catch(() => null);
    if (r?.ok) { const d = await r.json(); setJobs(d.items || []); }
  }
  async function fetchLlm() {
    const r = await fetch('/api/llm-activity?limit=50').catch(() => null);
    if (r?.ok) { const d = await r.json(); setLlmCalls(d.calls || []); }
  }
  async function fetchPosts() {
    const r = await fetch('/api/runs').catch(() => null); // posts come from analytics
    if (r?.ok) { /* posts loaded via analytics */ }
  }
  async function fetchAnalytics() {
    const r = await fetch('/api/analytics').catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setOverview(d.overview);
      setPosts(d.recentPosts || []);
      setPlatformBreakdown(d.platformBreakdown || []);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function triggerRun(type: 'image' | 'video' | 'all') {
    setTriggering(type);
    try {
      const r = await fetch(`/api/runs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: 'manual', type }),
      });
      const d = await r.json();
      const label = type === 'image' ? 'Image carousel' : type === 'video' ? 'Video reel' : 'Combined (Image + Video)';
      alert(`✅ ${label} pipeline started!\n${d.message || ''}`);
      fetchRuns(); fetchAnalytics();
    } catch (e: any) { alert('Failed: ' + e.message); }
    finally { setTriggering(null); }
  }

  async function connectAccount(platform: string) {
    setConnectingPlatform(platform);
    try {
      const r = await fetch('/api/social/auth-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, redirectUrl: window.location.origin + '/' }),
      });
      const data = await r.json();
      if (data.code && data.instructions) {
        setTelegramModalData({ code: data.code, botUsername: data.botUsername || 'LateScheduleBot', instructions: data.instructions });
        setShowAddAccountModal(false);
      } else if (data.authUrl) {
        window.open(data.authUrl, '_blank');
        setShowAddAccountModal(false);
        setTimeout(() => fetchAccounts(), 6000);
      } else {
        alert(data.error || 'Failed to get auth URL');
      }
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setConnectingPlatform(null); }
  }

  async function disconnectAccount(id: string) {
    if (!confirm('Disconnect this account?')) return;
    await fetch(`/api/social/accounts/${id}`, { method: 'DELETE' }).catch(() => null);
    fetchAccounts();
  }

  function copyCronUrl(type: 'image' | 'video' | 'all') {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app';
    const slot = type === 'image' ? 'morning' : type === 'video' ? 'weekly' : 'daily_all';
    const url = `${base}/api/run?type=${type}&slot=${slot}&secret=YOUR_CRON_SECRET`;
    navigator.clipboard.writeText(url);
    setCopiedCron(type);
    setTimeout(() => setCopiedCron(null), 2500);
  }

  const cronImageUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/run?type=image&slot=morning&secret=YOUR_CRON_SECRET`
    : '';
  const cronVideoUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/run?type=video&slot=weekly&secret=YOUR_CRON_SECRET`
    : '';
  const cronAllUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/run?type=all&slot=daily_all&secret=YOUR_CRON_SECRET`
    : '';

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090D16]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#090D16]">
        <div className="w-full max-w-sm bg-[#111827] border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex w-14 h-14 rounded-xl bg-blue-600 items-center justify-center font-black text-white text-3xl mb-3 shadow-lg shadow-blue-600/30">
              D
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">DinoMate Social Engine</h1>
            <p className="text-xs text-slate-400 mt-1">Enter your password to unlock</p>
          </div>
          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" /><span>{loginError}</span>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type="password" placeholder="Password" required autoFocus
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#090D16] border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-4 top-3.5 pointer-events-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm text-white transition disabled:opacity-50">
              {loading ? 'Verifying...' : 'Unlock Engine'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'runs', label: `Runs (${runs.length})`, icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: 'jobs', label: `Jobs (${jobs.length})`, icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'posts', label: `Posts (${posts.length})`, icon: <Image className="w-3.5 h-3.5" /> },
    { id: 'ai', label: `AI (${llmCalls.length})`, icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#090D16] flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base">D</div>
            <span className="font-bold text-sm tracking-tight text-white hidden sm:block">DinoMate Social Engine</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">LIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => triggerRun('image')} disabled={!!triggering}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50">
              <Image className="w-3.5 h-3.5" />
              <span className="hidden sm:block">{triggering === 'image' ? 'Starting...' : 'Image Run'}</span>
            </button>
            <button onClick={() => triggerRun('video')} disabled={!!triggering}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50">
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:block">{triggering === 'video' ? 'Starting...' : 'Video Run'}</span>
            </button>
            <button onClick={() => triggerRun('all')} disabled={!!triggering}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50">
              <Zap className="w-3.5 h-3.5" />
              <span>{triggering === 'all' ? 'Starting...' : 'Run All'}</span>
            </button>
            <button onClick={loadAll} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-5">

        {/* ── Accounts Bar ── */}
        {accounts.length === 0 ? (
          <div className="bg-[#111827] border border-blue-900/50 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" /> Connect Social Accounts via Zernio
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['telegram', 'instagram', 'youtube', 'x'].map((p) => (
                <button key={p} onClick={() => connectAccount(p)} disabled={connectingPlatform === p}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-700 bg-[#090D16] hover:bg-slate-800 text-xs font-semibold text-slate-200 capitalize transition">
                  <span>{platformEmoji[p] || '🔗'}</span>
                  <span>{connectingPlatform === p ? 'Connecting...' : `Connect ${p}`}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connected:</span>
            {accounts.map((acc) => (
              <div key={acc._id} className="flex items-center gap-1.5 bg-[#090D16] border border-slate-700 px-3 py-1 rounded-full text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="capitalize font-semibold text-slate-200">{platformEmoji[acc.platform] || ''} {acc.platform}</span>
                <span className="text-slate-500">({acc.handle})</span>
                <button onClick={() => disconnectAccount(acc._id)} className="ml-1 text-slate-600 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button onClick={() => setShowAddAccountModal(true)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <PlusCircle className="w-3.5 h-3.5" /> Add Account
            </button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 border-b border-slate-800 pb-0 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap border-b-2 -mb-px ${
                activeTab === t.id
                  ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: 'Runs Today', value: overview?.runsToday ?? '—', icon: <Play className="w-4 h-4" />, color: 'text-blue-400' },
                { label: 'Total Posts', value: overview?.postsTotal ?? '—', icon: <Globe className="w-4 h-4" />, color: 'text-emerald-400' },
                { label: 'Jobs Scanned', value: overview?.jobsTotal ?? '—', icon: <Briefcase className="w-4 h-4" />, color: 'text-amber-400' },
                { label: 'LLM Calls', value: overview?.llmCalls ?? '—', icon: <Zap className="w-4 h-4" />, color: 'text-purple-400' },
                { label: 'Est. Cost', value: overview ? `$${overview.llmCostUsd}` : '—', icon: <DollarSign className="w-4 h-4" />, color: 'text-rose-400' },
              ].map((s, i) => (
                <div key={i} className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className={`${s.color}`}>{s.icon}</div>
                  <div className="text-2xl font-black text-white">{s.value}</div>
                  <div className="text-xs text-slate-400">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Platform breakdown + recent activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" /> Posts by Platform
                </h3>
                {platformBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-500">No posts yet. Run the pipeline to get started.</p>
                ) : (
                  <div className="space-y-2">
                    {platformBreakdown.map((p) => (
                      <div key={p.platform} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-slate-200 font-semibold">
                          {platformEmoji[p.platform] || ''} {p.platform}
                        </span>
                        <span className="text-sm font-bold text-blue-400">{p.count} posts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Recent Runs
                </h3>
                {runs.slice(0, 4).map((r) => (
                  <div key={r._id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-mono">{r.slot}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor(r.status)}`}>{r.status}</span>
                      <span className="text-slate-500">{timeAgo(r.createdAt)}</span>
                    </div>
                  </div>
                ))}
                {runs.length === 0 && <p className="text-xs text-slate-500">No runs yet.</p>}
              </div>
            </div>

            {/* Cron endpoints */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                External Cron Endpoints (set up on cron-job.org)
              </h3>
              {[
                { type: 'image' as const, label: '📸 Image Carousel — run daily at 9am', url: cronImageUrl },
                { type: 'video' as const, label: '🎬 Video Reel — run every 2-3 days', url: cronVideoUrl },
                { type: 'all' as const, label: '⚡ All (Image + Video) — full batch', url: cronAllUrl },
              ].map(({ type, label, url }) => (
                <div key={type} className="space-y-1.5">
                  <p className="text-xs text-slate-400">{label}</p>
                  <div className="flex items-center gap-2 bg-[#090D16] border border-slate-800 rounded-lg p-2.5">
                    <code className="text-xs text-blue-300 font-mono flex-1 overflow-x-auto truncate">{url}</code>
                    <button onClick={() => copyCronUrl(type)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition shrink-0">
                      <Copy className="w-3 h-3" />
                      {copiedCron === type ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: RUNS
        ══════════════════════════════════════════════ */}
        {activeTab === 'runs' && (
          <div className="space-y-2">
            {runs.length === 0 && (
              <div className="text-center py-16 text-slate-500 text-sm">No runs yet. Click "Image Run" or "Video Run" to start.</div>
            )}
            {runs.map((r) => (
              <div key={r._id} className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedRun(expandedRun === r._id ? null : r._id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/30 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${statusColor(r.status)}`}>{r.status}</span>
                    <span className="font-mono text-sm text-blue-300 truncate">{r.slot}</span>
                    {r.errorMessage && <span className="text-xs text-red-400 truncate hidden sm:block">— {r.errorMessage}</span>}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-xs text-slate-400">
                    <span className="hidden sm:block">{r.itemsFound ?? 0} found / <span className="text-emerald-400 font-bold">{r.itemsPassed ?? 0} passed</span></span>
                    <span className="text-purple-400 font-bold">{r.postsPublished ?? 0} posts</span>
                    <span>{timeAgo(r.createdAt)}</span>
                    {expandedRun === r._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {expandedRun === r._id && (
                  <div className="border-t border-slate-800 px-5 py-4 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {(r.stages || []).map((s, i) => (
                        <div key={i} className={`flex flex-col px-3 py-2 rounded-lg border text-xs ${
                          s.status === 'completed' ? 'bg-emerald-950/30 border-emerald-900 text-emerald-300'
                          : s.status === 'failed' ? 'bg-red-950/30 border-red-900 text-red-300'
                          : 'bg-slate-800/40 border-slate-700 text-slate-400'
                        }`}>
                          <span className="font-bold uppercase tracking-wide">{s.name}</span>
                          <span className="opacity-70">{s.status}</span>
                          {(s.itemsIn !== undefined || s.itemsOut !== undefined) && (
                            <span className="opacity-60">{s.itemsIn ?? 0} → {s.itemsOut ?? 0}</span>
                          )}
                          {s.errorMessage && <span className="text-red-400 mt-1">{s.errorMessage}</span>}
                        </div>
                      ))}
                    </div>
                    {r.errorMessage && (
                      <div className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded-lg p-3">{r.errorMessage}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: JOBS
        ══════════════════════════════════════════════ */}
        {activeTab === 'jobs' && (
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jobs Audit Ledger</h3>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-400 font-bold">{jobs.filter((j) => j.status === 'passed').length} passed</span>
                <span className="text-amber-400 font-bold">{jobs.filter((j) => j.status === 'dropped').length} dropped</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090D16] text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Company / Role</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {jobs.map((j) => (
                    <tr key={j._id} className="hover:bg-slate-800/20 transition">
                      <td className="py-3 px-4">
                        <span className="font-bold text-white">{j.company}</span>
                        <span className="text-slate-400"> — {j.title}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{j.source}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor(j.status)}`}>{j.status}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{j.dropReason || '—'}</td>
                      <td className="py-3 px-4">
                        <a href={j.applyUrl} target="_blank" rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1 font-mono">
                          Link <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-slate-500">No jobs collected yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: POSTS
        ══════════════════════════════════════════════ */}
        {activeTab === 'posts' && (
          <div className="space-y-3">
            {posts.length === 0 && (
              <div className="text-center py-16 text-slate-500 text-sm">No published posts yet.</div>
            )}
            {posts.map((p) => (
              <div key={p._id} className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{platformEmoji[p.platform] || '🔗'}</span>
                    <span className="font-bold text-sm capitalize text-white">{p.platform}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor(p.status)}`}>{p.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                    <span>{timeAgo(p.createdAt)}</span>
                    {p.postUrl && (
                      <a href={p.postUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-300 line-clamp-3 whitespace-pre-wrap font-mono bg-[#090D16] rounded-lg p-3">
                  {p.caption}
                </p>
                {p.metrics && (
                  <div className="flex gap-4 text-xs">
                    {[
                      { label: '❤️ Likes', val: p.metrics.likes },
                      { label: '💬 Comments', val: p.metrics.comments },
                      { label: '🔁 Shares', val: p.metrics.shares },
                      { label: '👁️ Reach', val: p.metrics.reach },
                    ].map((m) => (
                      <div key={m.label} className="flex flex-col">
                        <span className="text-slate-400">{m.label}</span>
                        <span className="font-bold text-white">{m.val ?? 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: AI ACTIVITY
        ══════════════════════════════════════════════ */}
        {activeTab === 'ai' && (
          <div className="space-y-3">
            {/* Summary bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Calls', value: overview?.llmCalls ?? 0, color: 'text-blue-400' },
                { label: 'Total Tokens', value: (overview?.llmTokens ?? 0).toLocaleString(), color: 'text-purple-400' },
                { label: 'Est. Cost', value: `$${overview?.llmCostUsd ?? '0.00'}`, color: 'text-rose-400' },
                { label: 'Success Rate', value: `${overview?.llmSuccessRate ?? 100}%`, color: 'text-emerald-400' },
              ].map((s, i) => (
                <div key={i} className="bg-[#111827] border border-slate-800 rounded-xl p-4">
                  <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-400 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Call list */}
            {llmCalls.map((c) => (
              <div key={c._id} className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedLlm(expandedLlm === c._id ? null : c._id)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-800/30 transition">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.success ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                      {c.success ? 'OK' : 'FAIL'}
                    </span>
                    <span className="text-xs font-mono text-blue-300 font-bold">{c.alias}</span>
                    <span className="text-xs text-slate-400">{c.totalTokens ?? 0} tokens</span>
                    <span className="text-xs text-slate-500">{c.latencyMs ?? 0}ms</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{timeAgo(c.createdAt)}</span>
                    {expandedLlm === c._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {expandedLlm === c._id && (
                  <div className="border-t border-slate-800 p-4 space-y-3 text-xs">
                    <div>
                      <p className="text-slate-400 uppercase font-bold mb-1">Prompt</p>
                      <pre className="bg-[#090D16] rounded-lg p-3 text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-40 text-[11px]">{c.prompt}</pre>
                    </div>
                    {c.response && (
                      <div>
                        <p className="text-slate-400 uppercase font-bold mb-1">Response</p>
                        <pre className="bg-[#090D16] rounded-lg p-3 text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-40 text-[11px]">{c.response}</pre>
                      </div>
                    )}
                    {c.errorMessage && (
                      <p className="text-red-400 bg-red-950/30 border border-red-900 rounded-lg p-3">{c.errorMessage}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {llmCalls.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">No LLM calls logged yet.</div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: SETTINGS
        ══════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* Manual triggers */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white">Manual Pipeline Triggers</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <button onClick={() => triggerRun('image')} disabled={!!triggering}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white transition disabled:opacity-50">
                  <Image className="w-5 h-5" />
                  {triggering === 'image' ? 'Starting...' : '📸 Image Carousel'}
                </button>
                <button onClick={() => triggerRun('video')} disabled={!!triggering}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-bold text-white transition disabled:opacity-50">
                  <Video className="w-5 h-5" />
                  {triggering === 'video' ? 'Starting...' : '🎬 Video Reel'}
                </button>
                <button onClick={() => triggerRun('all')} disabled={!!triggering}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white transition disabled:opacity-50">
                  <Zap className="w-5 h-5" />
                  {triggering === 'all' ? 'Starting...' : '⚡ Both (Image + Video)'}
                </button>
              </div>
            </div>

            {/* Kill switch */}
            <div className="bg-[#111827] border border-red-900/40 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-red-400">Engine Kill Switch</h3>
              <p className="text-xs text-slate-400">When enabled, all cron triggers are rejected. Set <code className="bg-slate-800 px-1 rounded">ENGINE_KILL_SWITCH=true</code> in .env to activate on server.</p>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${killSwitch ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="text-sm font-semibold text-white">Engine is currently <span className={killSwitch ? 'text-red-400' : 'text-emerald-400'}>{killSwitch ? 'PAUSED' : 'RUNNING'}</span></span>
              </div>
            </div>

            {/* Cron endpoints */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white">External Cron URLs</h3>
              {[
                { type: 'image' as const, label: '📸 Image Carousel (daily 9am)', url: cronImageUrl },
                { type: 'video' as const, label: '🎬 Video Reel (every 2-3 days)', url: cronVideoUrl },
                { type: 'all' as const, label: '⚡ All (Image + Video together)', url: cronAllUrl },
              ].map(({ type, label, url }) => (
                <div key={type} className="space-y-1">
                  <p className="text-xs text-slate-400">{label}</p>
                  <div className="flex items-center gap-2 bg-[#090D16] border border-slate-800 rounded-lg p-2.5">
                    <code className="text-xs text-blue-300 font-mono flex-1 overflow-x-auto truncate">{url}</code>
                    <button onClick={() => copyCronUrl(type)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition shrink-0">
                      <Copy className="w-3 h-3" /> {copiedCron === type ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Webhook */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Zernio Webhook URL</h3>
              <p className="text-xs text-slate-400">Add this URL in your Zernio dashboard under Settings → Webhooks to receive post status + analytics callbacks:</p>
              <div className="flex items-center gap-2 bg-[#090D16] border border-slate-800 rounded-lg p-2.5">
                <code className="text-xs text-emerald-300 font-mono flex-1 overflow-x-auto truncate">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/zernio
                </code>
                <button onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/zernio`);
                  alert('Webhook URL copied!');
                }} className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition shrink-0">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Telegram Modal ── */}
      {telegramModalData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-blue-800 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" /> Connect via @{telegramModalData.botUsername}
            </h3>
            <div className="bg-[#090D16] border border-slate-800 p-4 rounded-xl">
              <p className="text-xs text-slate-400 mb-2">Verification Code:</p>
              <div className="flex items-center justify-between bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg">
                <code className="text-sm font-mono text-emerald-400 font-bold">{telegramModalData.code}</code>
                <button onClick={() => { navigator.clipboard.writeText(telegramModalData.code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded transition">
                  {copiedCode ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
              {telegramModalData.instructions.map((step, i) => <li key={i}>{step}</li>)}
            </ul>
            <div className="flex gap-2 pt-1">
              <a href={`https://t.me/${telegramModalData.botUsername}`} target="_blank" rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white text-center transition">
                Open @{telegramModalData.botUsername}
              </a>
              <button onClick={() => { setTelegramModalData(null); fetchAccounts(); }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Account Modal ── */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-sm text-white">Connect Platform</h3>
            <div className="grid grid-cols-2 gap-3">
              {['telegram', 'instagram', 'youtube', 'x'].map((p) => (
                <button key={p} onClick={() => connectAccount(p)} disabled={connectingPlatform === p}
                  className="p-3 rounded-xl border border-slate-700 bg-[#090D16] hover:bg-slate-800 text-xs font-semibold capitalize transition flex items-center justify-center gap-2">
                  <span>{platformEmoji[p] || '🔗'}</span>
                  <span>{connectingPlatform === p ? '...' : p}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddAccountModal(false)} className="w-full py-2 text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
