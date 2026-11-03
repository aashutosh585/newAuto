export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Social Engine • Control Center</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8' },
            dark: { 800: '#1E293B', 900: '#0F172A', 950: '#090D16' }
          }
        }
      }
    }
  </script>
  <style>
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="bg-dark-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased">

  <!-- TOP NAVIGATION -->
  <header class="border-b border-slate-800 bg-dark-900/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-lg">⚡</div>
        <span class="font-bold text-lg tracking-tight">Social Engine <span class="text-blue-400 text-xs px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800 ml-1">v3 Zernio</span></span>
      </div>
      <div class="flex items-center space-x-4">
        <button id="btn-killswitch" onclick="toggleKillSwitch()" class="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Engine Active
        </button>
        <button onclick="triggerRunNow()" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition">
          + Trigger Run
        </button>
        <button onclick="logout()" class="text-xs text-slate-400 hover:text-white">Logout</button>
      </div>
    </div>
  </header>

  <!-- NAVIGATION TABS -->
  <nav class="border-b border-slate-800 bg-dark-900 px-4">
    <div class="max-w-7xl mx-auto flex space-x-1 sm:space-x-4 overflow-x-auto py-2">
      <button onclick="showTab('overview')" id="tab-overview" class="tab-btn active px-3 py-1.5 rounded-md text-sm font-medium text-white bg-slate-800">Overview</button>
      <button onclick="showTab('runs')" id="tab-runs" class="tab-btn px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white">Runs & Stages</button>
      <button onclick="showTab('ai')" id="tab-ai" class="tab-btn px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white">AI Gateway</button>
      <button onclick="showTab('posts')" id="tab-posts" class="tab-btn px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white">Posts & Zernio</button>
      <button onclick="showTab('jobs')" id="tab-jobs" class="tab-btn px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white">Jobs & Drop Reasons</button>
      <button onclick="showTab('accounts')" id="tab-accounts" class="tab-btn px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white">Account Health</button>
      <button onclick="showTab('settings')" id="tab-settings" class="tab-btn px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white">Settings</button>
    </div>
  </nav>

  <!-- MAIN CONTENT CONTAINER -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">

    <!-- 1. OVERVIEW VIEW -->
    <div id="view-overview" class="view-panel space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-dark-900 border border-slate-800 rounded-xl p-5">
          <div class="text-xs uppercase font-medium text-slate-400">Pipeline Runs</div>
          <div class="text-2xl font-bold mt-2" id="stat-total-runs">0</div>
          <div class="text-xs text-emerald-400 mt-1" id="stat-success-rate">100% success rate</div>
        </div>
        <div class="bg-dark-900 border border-slate-800 rounded-xl p-5">
          <div class="text-xs uppercase font-medium text-slate-400">Total Posts Published</div>
          <div class="text-2xl font-bold mt-2 text-blue-400" id="stat-total-posts">0</div>
          <div class="text-xs text-slate-400 mt-1">Telegram & Instagram</div>
        </div>
        <div class="bg-dark-900 border border-slate-800 rounded-xl p-5">
          <div class="text-xs uppercase font-medium text-slate-400">LiteLLM Spend</div>
          <div class="text-2xl font-bold mt-2 text-purple-400" id="stat-llm-cost">$0.00</div>
          <div class="text-xs text-slate-400 mt-1" id="stat-llm-tokens">0 tokens</div>
        </div>
        <div class="bg-dark-900 border border-slate-800 rounded-xl p-5">
          <div class="text-xs uppercase font-medium text-slate-400">Publisher Gateway</div>
          <div class="text-2xl font-bold mt-2 text-emerald-400">Zernio API</div>
          <div class="text-xs text-slate-400 mt-1">Hosted OAuth & Dispatch</div>
        </div>
      </div>

      <!-- Recent Runs List -->
      <div class="bg-dark-900 border border-slate-800 rounded-xl p-6">
        <h2 class="text-base font-semibold mb-4">Recent Executions</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th class="pb-3">Slot / Run ID</th>
                <th class="pb-3">Niche</th>
                <th class="pb-3">Status</th>
                <th class="pb-3">Stages Timeline</th>
                <th class="pb-3">Triggered</th>
              </tr>
            </thead>
            <tbody id="overview-runs-table" class="divide-y divide-slate-800 text-slate-300">
              <tr><td colspan="5" class="py-4 text-center text-slate-500">Loading pipeline runs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 2. RUNS VIEW -->
    <div id="view-runs" class="view-panel hidden space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-bold">Pipeline Runs & Stage History</h2>
        <button onclick="loadRuns()" class="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded">Refresh</button>
      </div>
      <div class="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase bg-slate-900 text-slate-400 border-b border-slate-800">
            <tr>
              <th class="py-3 px-4">Run ID</th>
              <th class="py-3 px-4">Slot</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Stages</th>
              <th class="py-3 px-4">Error / Notes</th>
              <th class="py-3 px-4">Time</th>
            </tr>
          </thead>
          <tbody id="runs-table-body" class="divide-y divide-slate-800 text-slate-300">
            <!-- Dynamically populated -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. AI VIEW -->
    <div id="view-ai" class="view-panel hidden space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-bold">LiteLLM Gateway Calls</h2>
        <span class="text-xs text-slate-400">Aliases: fast, writer, writer-local</span>
      </div>
      <div class="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase bg-slate-900 text-slate-400 border-b border-slate-800">
            <tr>
              <th class="py-3 px-4">Alias</th>
              <th class="py-3 px-4">Model Used</th>
              <th class="py-3 px-4">Tokens</th>
              <th class="py-3 px-4">Latency</th>
              <th class="py-3 px-4">Cost (USD)</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Timestamp</th>
            </tr>
          </thead>
          <tbody id="ai-table-body" class="divide-y divide-slate-800 text-slate-300">
            <!-- Dynamically populated -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- 4. POSTS VIEW -->
    <div id="view-posts" class="view-panel hidden space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-bold">Published Posts & Zernio Status</h2>
      </div>
      <div class="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase bg-slate-900 text-slate-400 border-b border-slate-800">
            <tr>
              <th class="py-3 px-4">Channel</th>
              <th class="py-3 px-4">Publisher</th>
              <th class="py-3 px-4">Zernio Post ID</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Post Link</th>
              <th class="py-3 px-4">Published At</th>
            </tr>
          </thead>
          <tbody id="posts-table-body" class="divide-y divide-slate-800 text-slate-300">
            <!-- Dynamically populated -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- 5. JOBS DATA VIEW -->
    <div id="view-jobs" class="view-panel hidden space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-bold">Collected Items & Rejection Ledger</h2>
        <span class="text-xs text-slate-400">Quality filter audit trail</span>
      </div>
      <div class="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase bg-slate-900 text-slate-400 border-b border-slate-800">
            <tr>
              <th class="py-3 px-4">Company & Title</th>
              <th class="py-3 px-4">Source</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Liveness</th>
              <th class="py-3 px-4">Drop Reason</th>
              <th class="py-3 px-4">Apply URL</th>
            </tr>
          </thead>
          <tbody id="jobs-table-body" class="divide-y divide-slate-800 text-slate-300">
            <!-- Dynamically populated -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- 6. ACCOUNTS HEALTH VIEW -->
    <div id="view-accounts" class="view-panel hidden space-y-6">
      <h2 class="text-lg font-bold">Connected Platform Accounts</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="accounts-cards-container">
        <!-- Dynamically populated -->
      </div>
    </div>

    <!-- 7. SETTINGS VIEW -->
    <div id="view-settings" class="view-panel hidden space-y-6">
      <h2 class="text-lg font-bold">Engine Settings & Operations</h2>
      <div class="bg-dark-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div>
          <h3 class="font-semibold text-sm">Emergency Kill Switch</h3>
          <p class="text-xs text-slate-400 mt-1">Pauses all cron triggers and active BullMQ pipeline jobs immediately.</p>
          <button onclick="toggleKillSwitch()" class="mt-3 px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white">
            Toggle Kill Switch
          </button>
        </div>
        <hr class="border-slate-800">
        <div>
          <h3 class="font-semibold text-sm">Manual Pipeline Trigger</h3>
          <p class="text-xs text-slate-400 mt-1">Force triggers an on-demand run without waiting for cron schedule.</p>
          <div class="flex gap-2 mt-3">
            <input type="text" id="manual-slot-input" placeholder="slot (e.g. afternoon_test)" class="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white">
            <button onclick="triggerRunNow()" class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white">Trigger</button>
          </div>
        </div>
      </div>
    </div>

  </main>

  <script>
    function showTab(tabId) {
      document.querySelectorAll('.view-panel').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-slate-800', 'text-white');
        el.classList.add('text-slate-400');
      });
      document.getElementById('view-' + tabId).classList.remove('hidden');
      const activeBtn = document.getElementById('tab-' + tabId);
      activeBtn.classList.add('bg-slate-800', 'text-white');
      activeBtn.classList.remove('text-slate-400');

      if (tabId === 'overview') loadOverview();
      if (tabId === 'runs') loadRuns();
      if (tabId === 'ai') loadAi();
      if (tabId === 'posts') loadPosts();
      if (tabId === 'jobs') loadJobs();
      if (tabId === 'accounts') loadAccounts();
    }

    async function loadOverview() {
      try {
        const res = await fetch('/api/overview');
        if (res.status === 401) return (window.location.href = '/login');
        const data = await res.json();

        document.getElementById('stat-total-runs').innerText = data.runs.total;
        document.getElementById('stat-success-rate').innerText = data.runs.successRate + '% success rate';
        document.getElementById('stat-total-posts').innerText = data.posts.total;
        document.getElementById('stat-llm-cost').innerText = '$' + data.ai.totalCostUsd;
        document.getElementById('stat-llm-tokens').innerText = data.ai.totalTokens.toLocaleString() + ' tokens';

        const ksBtn = document.getElementById('btn-killswitch');
        if (data.killSwitchActive) {
          ksBtn.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> Engine Paused';
          ksBtn.classList.add('border-red-800', 'text-red-400');
        } else {
          ksBtn.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Engine Active';
          ksBtn.classList.remove('border-red-800', 'text-red-400');
        }

        const tbody = document.getElementById('overview-runs-table');
        tbody.innerHTML = (data.recentRuns || []).map(r => \`
          <tr class="hover:bg-slate-900/50">
            <td class="py-3 font-mono text-xs">\${r.slot} <span class="text-slate-500">(\${r.id.slice(0, 8)})</span></td>
            <td class="py-3 capitalize">\${r.niche}</td>
            <td class="py-3"><span class="px-2 py-0.5 rounded text-xs font-semibold \${r.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' : r.status === 'FAILED' ? 'bg-red-950 text-red-400' : 'bg-blue-950 text-blue-400'}">\${r.status}</span></td>
            <td class="py-3">
              <div class="flex gap-1">
                \${(r.stages || []).map(s => \`<span title="\${s.name}: \${s.status}" class="w-2.5 h-2.5 rounded-full \${s.status === 'COMPLETED' ? 'bg-emerald-500' : s.status === 'FAILED' ? 'bg-red-500' : 'bg-slate-600'}"></span>\`).join('')}
              </div>
            </td>
            <td class="py-3 text-xs text-slate-400">\${new Date(r.createdAt).toLocaleTimeString()}</td>
          </tr>
        \`).join('') || '<tr><td colspan="5" class="py-4 text-center text-slate-500">No runs recorded yet.</td></tr>';
      } catch (e) {
        console.error(e);
      }
    }

    async function loadRuns() {
      const res = await fetch('/api/runs');
      const runs = await res.json();
      const tbody = document.getElementById('runs-table-body');
      tbody.innerHTML = runs.map(r => \`
        <tr class="hover:bg-slate-900/50">
          <td class="py-3 px-4 font-mono text-xs">\${r.id.slice(0, 8)}</td>
          <td class="py-3 px-4">\${r.slot}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-xs font-semibold \${r.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' : r.status === 'FAILED' ? 'bg-red-950 text-red-400' : 'bg-slate-800 text-slate-300'}">\${r.status}</span></td>
          <td class="py-3 px-4 text-xs">\${r.stages.length} stages</td>
          <td class="py-3 px-4 text-xs text-red-400">\${r.errorMessage || '-'}</td>
          <td class="py-3 px-4 text-xs text-slate-400">\${new Date(r.createdAt).toLocaleString()}</td>
        </tr>
      \`).join('');
    }

    async function loadAi() {
      const res = await fetch('/api/ai');
      const calls = await res.json();
      const tbody = document.getElementById('ai-table-body');
      tbody.innerHTML = calls.map(c => \`
        <tr class="hover:bg-slate-900/50">
          <td class="py-3 px-4 font-semibold text-blue-400">\${c.alias}</td>
          <td class="py-3 px-4 text-xs font-mono">\${c.model}</td>
          <td class="py-3 px-4 text-xs">\${c.totalTokens}</td>
          <td class="py-3 px-4 text-xs">\${c.latencyMs}ms</td>
          <td class="py-3 px-4 text-xs text-purple-400">\$\${c.costUsd.toFixed(4)}</td>
          <td class="py-3 px-4 text-xs">\${c.status}</td>
          <td class="py-3 px-4 text-xs text-slate-400">\${new Date(c.createdAt).toLocaleTimeString()}</td>
        </tr>
      \`).join('');
    }

    async function loadPosts() {
      const res = await fetch('/api/posts');
      const posts = await res.json();
      const tbody = document.getElementById('posts-table-body');
      tbody.innerHTML = posts.map(p => \`
        <tr class="hover:bg-slate-900/50">
          <td class="py-3 px-4 font-semibold uppercase text-xs">\${p.channel}</td>
          <td class="py-3 px-4 text-xs">\${p.publisherUsed}</td>
          <td class="py-3 px-4 font-mono text-xs">\${p.externalPostId || '-'}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-xs font-semibold \${p.status === 'PUBLISHED' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}">\${p.status}</span></td>
          <td class="py-3 px-4 text-xs">\${p.externalPostUrl ? \`<a href="\${p.externalPostUrl}" target="_blank" class="text-blue-400 underline">View Post ↗</a>\` : '-'}</td>
          <td class="py-3 px-4 text-xs text-slate-400">\${p.publishedAt ? new Date(p.publishedAt).toLocaleTimeString() : '-'}</td>
        </tr>
      \`).join('');
    }

    async function loadJobs() {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      const tbody = document.getElementById('jobs-table-body');
      tbody.innerHTML = (data.items || []).map(j => \`
        <tr class="hover:bg-slate-900/50">
          <td class="py-3 px-4"><span class="font-semibold">\${j.rawData?.company || 'Company'}</span>: \${j.rawData?.title || 'Title'}</td>
          <td class="py-3 px-4 text-xs">\${j.source}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-xs \${j.status === 'PASSED_TO_RANK' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}">\${j.status}</span></td>
          <td class="py-3 px-4 text-xs">\${j.isLive ? '🟢 Live' : '🔴 Dead Link'}</td>
          <td class="py-3 px-4 text-xs text-slate-400">\${j.dropReason || 'Kept'}</td>
          <td class="py-3 px-4 text-xs"><a href="\${j.externalUrl}" target="_blank" class="text-blue-400 underline">Link ↗</a></td>
        </tr>
      \`).join('');
    }

    async function loadAccounts() {
      const res = await fetch('/api/accounts');
      const accounts = await res.json();
      const container = document.getElementById('accounts-cards-container');
      container.innerHTML = accounts.map(a => \`
        <div class="bg-dark-900 border border-slate-800 rounded-xl p-5">
          <div class="flex justify-between items-center">
            <span class="text-sm font-bold uppercase text-slate-300">\${a.platform}</span>
            <span class="px-2 py-0.5 rounded text-xs font-semibold \${a.status === 'HEALTHY' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}">\${a.status}</span>
          </div>
          <div class="text-xs text-slate-400 mt-2 font-mono">\${a.accountIdentifier || 'Unconfigured'}</div>
          \${a.lastError ? \`<div class="text-xs text-red-400 mt-2 bg-red-950/40 p-2 rounded border border-red-900">\${a.lastError}</div>\` : ''}
        </div>
      \`).join('');
    }

    async function triggerRunNow() {
      const slot = document.getElementById('manual-slot-input')?.value || 'manual_slot';
      const res = await fetch('/api/settings/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot })
      });
      const data = await res.json();
      alert('Run triggered successfully: ' + data.runId);
      loadOverview();
    }

    async function toggleKillSwitch() {
      const res = await fetch('/api/settings/toggle-killswitch', { method: 'POST' });
      const data = await res.json();
      alert('Kill switch is now: ' + (data.killSwitchActive ? 'PAUSED' : 'ACTIVE'));
      loadOverview();
    }

    function logout() {
      document.cookie = "se_dashboard_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      window.location.href = '/login';
    }

    loadOverview();
  </script>
</body>
</html>`;
}

export function renderLoginHtml(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login • Social Engine</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
    <div class="text-center mb-6">
      <div class="inline-flex w-12 h-12 rounded-xl bg-blue-600 items-center justify-center font-black text-white text-2xl mb-3">⚡</div>
      <h1 class="text-xl font-bold">Social Engine</h1>
      <p class="text-xs text-slate-400 mt-1">Enter your password to access the dashboard</p>
    </div>

    ${error ? `<div class="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs text-center">${error}</div>` : ''}

    <form method="POST" action="/login" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-slate-300 mb-1">Master Password</label>
        <input type="password" name="password" required autofocus class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
      </div>
      <button type="submit" class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm text-white transition">Sign In</button>
    </form>
  </div>
</body>
</html>`;
}
