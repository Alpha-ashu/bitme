import { adminApi, adminUploadFile, getAdminToken, setAdminToken, SERVER_URL, resolveMediaUrl, fmtNum, fmtTime } from '../api/ApiClient';
import { renderDonutChart, renderRetentionBars, renderTrendChart } from '../components/Charts';
import { esc, safeUrl } from '../utils/escapeHtml';
import { AppContext } from './types';

type AdminTab = 'telemetry' | 'analytics' | 'rpg' | 'reports' | 'ads' | 'users' | 'coupons' | 'audit';

interface AdminPortalState {
  adminUser: { id: string; username: string; email: string; role: 'admin' | 'super_admin' } | null;
  tab: AdminTab;
  loginError: string;
  telemetry: any;
  overview: any;
  rpgAnalytics: any;
  rpgQuestions: any[];
  rpgOverrides: any[];
  rpgOverridePreview: any;
  report: any;
  reportPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  reportStart: string;
  reportEnd: string;
  ads: any[];
  editingAdId: string | null;
  adDraft: {
    title: string;
    description: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    destinationUrl: string;
    placement: string;
    enabled: boolean;
    startsAt: string;
    endsAt: string;
  };
  uploadBusy: boolean;
  usersData: { total: number; users: any[] };
  userSearch: string;
  userRoleFilter: string;
  userStatusFilter: string;
  adminsList: any[];
  coupons: any[];
  audit: { adminLogs: any[]; antiCheatLogs: any[] };
  busy: boolean;
}

const nowLocalInput = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const portal: AdminPortalState = {
  adminUser: null,
  tab: 'telemetry',
  loginError: '',
  telemetry: null,
  overview: null,
  rpgAnalytics: null,
  rpgQuestions: [],
  rpgOverrides: [],
  rpgOverridePreview: null,
  report: null,
  reportPeriod: 'weekly',
  reportStart: new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10),
  reportEnd: new Date().toISOString().slice(0, 10),
  ads: [],
  editingAdId: null,
  adDraft: {
    title: '',
    description: '',
    mediaUrl: '',
    mediaType: 'image',
    destinationUrl: '',
    placement: 'home_screen',
    enabled: true,
    startsAt: nowLocalInput(0),
    endsAt: nowLocalInput(30),
  },
  uploadBusy: false,
  usersData: { total: 0, users: [] },
  userSearch: '',
  userRoleFilter: '',
  userStatusFilter: '',
  adminsList: [],
  coupons: [],
  audit: { adminLogs: [], antiCheatLogs: [] },
  busy: false,
};

async function ensureAdminSession(): Promise<boolean> {
  if (portal.adminUser) return true;
  if (!getAdminToken()) return false;
  const r = await adminApi('/api/admin/auth/me');
  if (r.ok && r.data?.admin) {
    portal.adminUser = r.data.admin;
    return true;
  }
  setAdminToken(null);
  return false;
}

async function loadTabData(tab: AdminTab) {
  portal.busy = true;
  if (tab === 'telemetry') {
    const [tel, ov] = await Promise.all([
      adminApi('/api/admin/telemetry'),
      adminApi('/api/admin/analytics/overview'),
    ]);
    if (tel.ok) portal.telemetry = tel.data.telemetry;
    if (ov.ok) portal.overview = ov.data;
  } else if (tab === 'analytics') {
    const ov = await adminApi('/api/admin/analytics/overview');
    if (ov.ok) portal.overview = ov.data;
  } else if (tab === 'rpg') {
    const [rpg, qs, ovs] = await Promise.all([
      adminApi('/api/admin/analytics/rpg'),
      adminApi('/api/admin/content/questions?limit=80'),
      adminApi('/api/admin/content/overrides'),
    ]);
    if (rpg.ok) portal.rpgAnalytics = rpg.data;
    if (qs.ok) portal.rpgQuestions = qs.data.questions || [];
    if (ovs.ok) portal.rpgOverrides = ovs.data.overrides || [];
  } else if (tab === 'reports') {
    const q = new URLSearchParams({ period: portal.reportPeriod });
    if (portal.reportPeriod === 'custom') {
      q.set('startDate', portal.reportStart);
      q.set('endDate', portal.reportEnd);
    }
    const r = await adminApi(`/api/admin/analytics/reports?${q.toString()}`);
    if (r.ok) portal.report = r.data;
  } else if (tab === 'ads') {
    const r = await adminApi('/api/admin/ads');
    if (r.ok) portal.ads = r.data.ads || [];
  } else if (tab === 'users') {
    const q = new URLSearchParams({ limit: '50' });
    if (portal.userSearch) q.set('search', portal.userSearch);
    if (portal.userRoleFilter) q.set('role', portal.userRoleFilter);
    if (portal.userStatusFilter) q.set('status', portal.userStatusFilter);
    const [u, adm] = await Promise.all([
      adminApi(`/api/admin/users?${q.toString()}`),
      adminApi('/api/admin/admins'),
    ]);
    if (u.ok) portal.usersData = u.data;
    if (adm.ok) portal.adminsList = adm.data.admins || [];
  } else if (tab === 'coupons') {
    const c = await adminApi('/api/admin/coupons');
    if (c.ok) portal.coupons = c.data.coupons || [];
  } else if (tab === 'audit') {
    const a = await adminApi('/api/admin/audit-logs');
    if (a.ok) portal.audit = a.data;
  }
  portal.busy = false;
}

export function renderAdminScreen(root: HTMLElement, ctx: AppContext): void {
  if (!portal.adminUser && getAdminToken()) {
    root.innerHTML = `<div class="admin-shell"><div class="panel admin-login-card"><p>Verifying administrator session…</p></div></div>`;
    void ensureAdminSession().then(async (ok) => {
      if (ok) await loadTabData(portal.tab);
      renderAdminScreen(root, ctx);
    });
    return;
  }

  if (!portal.adminUser) {
    root.innerHTML = `
      <div class="admin-shell">
        <div class="panel admin-login-card">
          <div class="admin-login-badge">🛡️ ADMIN PORTAL</div>
          <h1>CoilQuest Admin</h1>
          <p class="subtitle">Authorised administrator sign in.</p>
          ${portal.loginError ? `<div class="alert-error">${esc(portal.loginError)}</div>` : ''}
          <form id="adm-login-form" class="stack-form">
            <label>Admin Username
              <input id="adm-user" type="text" required autocomplete="username" placeholder="Enter admin username" />
            </label>
            <label>Password
              <input id="adm-pass" type="password" required autocomplete="current-password" placeholder="Enter admin password" />
            </label>
            <button type="submit" class="btn btn-primary btn-block">Sign In to Admin Dashboard</button>
          </form>
          <div class="admin-login-footer">
            <button id="adm-back-home" class="btn btn-ghost btn-sm">← Return to Game</button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#adm-back-home')?.addEventListener('click', () => {
      portal.loginError = '';
      ctx.setScreen('app');
    });
    root.querySelector('#adm-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      portal.loginError = '';
      const username = (root.querySelector('#adm-user') as HTMLInputElement).value.trim();
      const password = (root.querySelector('#adm-pass') as HTMLInputElement).value;
      const res = await adminApi('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        portal.loginError = res.data?.error || 'Login failed';
        renderAdminScreen(root, ctx);
        return;
      }
      setAdminToken(res.data.token);
      portal.adminUser = res.data.user;
      await loadTabData(portal.tab);
      renderAdminScreen(root, ctx);
    });
    return;
  }

  const adm = portal.adminUser;
  const tabs: Array<{ id: AdminTab; icon: string; label: string }> = [
    { id: 'telemetry', icon: '⚡', label: 'Telemetry' },
    { id: 'analytics', icon: '📊', label: 'Analytics' },
    { id: 'rpg', icon: '🐉', label: 'RPG CMS & Quiz' },
    { id: 'reports', icon: '📈', label: 'Reports & CSV' },
    { id: 'ads', icon: '📣', label: 'Ad Manager' },
    { id: 'users', icon: '👥', label: 'Users & Admins' },
    { id: 'coupons', icon: '🎟️', label: 'Coupons' },
    { id: 'audit', icon: '🛡️', label: 'Audit Logs' },
  ];

  root.innerHTML = `
    <div class="admin-shell">
      <header class="admin-topbar">
        <div class="admin-brand">
          <span class="admin-shield">🛡️</span>
          <div>
            <strong>CoilQuest Command</strong>
            <span class="badge badge-role">${esc(adm.role.toUpperCase())} · ${esc(adm.username)}</span>
          </div>
        </div>
        <div class="admin-top-actions">
          <button id="adm-refresh" class="btn btn-sm btn-soft">↻ Refresh</button>
          <button id="adm-to-game" class="btn btn-sm btn-soft">🎮 View Game</button>
          <button id="adm-logout" class="btn btn-sm btn-danger">Sign Out</button>
        </div>
      </header>

      <nav class="admin-tabs">
        ${tabs.map(t => `<button class="admin-tab ${portal.tab === t.id ? 'active' : ''}" data-tab="${t.id}"><span>${t.icon}</span> ${esc(t.label)}</button>`).join('')}
      </nav>

      <main class="admin-body" id="admin-tab-content">
        ${renderAdminTabBody()}
      </main>
    </div>
  `;

  bindAdminEvents(root, ctx);
}

function renderAdminTabBody(): string {
  switch (portal.tab) {
    case 'telemetry': return renderTelemetryTab();
    case 'analytics': return renderAnalyticsTab();
    case 'rpg': return renderRpgCmsTab();
    case 'reports': return renderReportsTab();
    case 'ads': return renderAdsTab();
    case 'users': return renderUsersTab();
    case 'coupons': return renderCouponsTab();
    case 'audit': return renderAuditTab();
  }
}

function renderRpgCmsTab(): string {
  const r = portal.rpgAnalytics || {};
  const adv = r.adventure || {};
  const q = r.quests || {};
  const edu = r.educational || {};
  const boss = r.bosses || {};
  const mp = r.multiplayerObjectives || {};

  return `
    <div class="kpi-grid">
      <div class="kpi-card accent-green">
        <span>Adventure Campaign</span>
        <strong>${fmtNum(adv.levelsCompleted || 0)} / ${fmtNum(adv.levelsStarted || 0)}</strong>
        <small>${adv.completionRate ?? 0}% clear · Max Lv.${adv.highestAdventureLevel ?? 1}</small>
      </div>
      <div class="kpi-card accent-gold">
        <span>Quest Funnel</span>
        <strong>${fmtNum(q.accepted || 0)} Accept · ${fmtNum(q.claimed || 0)} Claim</strong>
        <small>${q.npcEncounters ?? 0} NPC hits · ${q.later ?? 0} Later · ${q.skipped ?? 0} Skip</small>
      </div>
      <div class="kpi-card accent-blue">
        <span>Educational Quizzes</span>
        <strong>${edu.accuracyPct ?? 0}% Accuracy</strong>
        <small>${fmtNum(edu.totalAttempts || 0)} answers · ${edu.avgResponseMs ?? 0}ms avg</small>
      </div>
      <div class="kpi-card">
        <span>Bosses &amp; Team Objectives</span>
        <strong>${fmtNum(boss.victories || 0)} Boss Wins</strong>
        <small>${mp.teamZoneCaptures ?? 0} zones · ${mp.teamRelicsDelivered ?? 0} relics · ${mp.privateRoomsCreated ?? 0} rooms</small>
      </div>
    </div>

    <div class="admin-split" style="margin-top:14px">
      <section class="panel">
        <h3>Question Bank CMS (${portal.rpgQuestions.length})</h3>
        <form id="rpg-q-form" class="stack-form" style="margin-top:8px">
          <div class="form-row-2">
            <label>Category
              <select id="rpg-q-cat">
                <option value="word">Word Puzzle</option>
                <option value="math">Math Challenge</option>
                <option value="memory">Memory Trial</option>
                <option value="logic">Logic Puzzle</option>
              </select>
            </label>
            <label>Difficulty (1-5)
              <input id="rpg-q-diff" type="number" min="1" max="5" value="1" />
            </label>
          </div>
          <label>Prompt
            <input id="rpg-q-prompt" type="text" required placeholder="Unscramble: E T R S F O" />
          </label>
          <label>Options (comma-separated, 2–6)
            <input id="rpg-q-opts" type="text" required placeholder="FOREST, FROST, FORTS, FOSTER" />
          </label>
          <div class="form-row-2">
            <label>Correct Answer (exact option)
              <input id="rpg-q-ans" type="text" required placeholder="FOREST" />
            </label>
            <label>Status
              <select id="rpg-q-status">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
          <label>Explanation
            <input id="rpg-q-exp" type="text" required placeholder="FOREST uses the letters F-O-R-E-S-T." />
          </label>
          <button type="submit" class="btn btn-primary btn-sm">Save Question</button>
        </form>

        <div class="table-scroll" style="margin-top:12px;max-height:260px">
          <table class="data-table">
            <thead><tr><th>Cat</th><th>Diff</th><th>Prompt</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${portal.rpgQuestions.slice(0, 30).map((item: any) => `
                <tr>
                  <td><span class="pill">${esc(item.category)}</span></td>
                  <td>${item.difficulty}</td>
                  <td><small>${esc(String(item.questionText || item.prompt || '').slice(0, 56))}</small></td>
                  <td><small>${esc(item.status)}</small></td>
                  <td><button class="btn btn-xs btn-danger" data-rpg-q-del="${esc(item.questionId)}">Del</button></td>
                </tr>
              `).join('') || `<tr><td colspan="5">No questions found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h3>Live Level / Quest / Boss / Event Overrides</h3>
        <form id="rpg-ov-form" class="stack-form" style="margin-top:8px">
          <div class="form-row-2">
            <label>Entity Type
              <select id="rpg-ov-type">
                <option value="campaign_level">campaign_level</option>
                <option value="quest">quest</option>
                <option value="npc">npc</option>
                <option value="boss">boss</option>
                <option value="world_event">world_event</option>
                <option value="team_objective">team_objective</option>
              </select>
            </label>
            <label>Entity ID
              <input id="rpg-ov-id" type="text" required placeholder="lvl_10" />
            </label>
          </div>
          <label>Override JSON Payload
            <textarea id="rpg-ov-json" rows="3" required>{"title":"Festival Guardian Trial","rewards":{"stars":250}}</textarea>
          </label>
          <div class="form-row-2">
            <label>Publish Status
              <select id="rpg-ov-status">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <div style="display:flex;align-items:flex-end">
              <button type="submit" class="btn btn-gold btn-sm">Save &amp; Preview</button>
            </div>
          </div>
        </form>
        ${portal.rpgOverridePreview ? `
          <div class="panel" style="margin-top:8px;padding:8px">
            <small class="muted">Live Preview:</small>
            <pre style="font-size:11px;white-space:pre-wrap;margin:4px 0 0">${esc(JSON.stringify(portal.rpgOverridePreview, null, 2).slice(0, 500))}</pre>
          </div>
        ` : ''}
        <div class="table-scroll" style="margin-top:10px;max-height:200px">
          <table class="data-table">
            <thead><tr><th>Type</th><th>ID</th><th>Status</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              ${portal.rpgOverrides.map((o: any) => `
                <tr>
                  <td><span class="pill">${esc(o.entityType)}</span></td>
                  <td><b>${esc(o.entityId)}</b></td>
                  <td><small>${esc(o.status)}</small></td>
                  <td><small>${esc(String(o.updatedAt || '').slice(0, 16))}</small></td>
                  <td><button class="btn btn-xs btn-danger" data-rpg-ov-del="${esc(o.entityType)}::${esc(o.entityId)}">Del</button></td>
                </tr>
              `).join('') || `<tr><td colspan="5">No live overrides published.</td></tr>`}
            </tbody>
          </table>
        </div>

        <h4 style="margin-top:12px">Quiz Accuracy by Category</h4>
        <div class="table-scroll" style="margin-top:4px">
          <table class="data-table">
            <thead><tr><th>Category</th><th>Attempts</th><th>Accuracy</th><th>Avg ms</th></tr></thead>
            <tbody>
              ${(edu.byCategory || []).map((c: any) => `
                <tr><td>${esc(c.category)}</td><td>${c.attempts}</td><td>${c.accuracyPct}%</td><td>${c.avgResponseMs}ms</td></tr>
              `).join('') || `<tr><td colspan="4">No quiz attempts yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderTelemetryTab(): string {
  const t = portal.telemetry || {};
  const u = portal.overview?.users || {};
  const g = portal.overview?.gameplay || {};
  return `
    <div class="kpi-grid">
      <div class="kpi-card accent-green"><span>Online Presence</span><strong>${fmtNum(t.totalPlayersOnline)}</strong><small>${fmtNum(t.activeSockets)} live sockets</small></div>
      <div class="kpi-card accent-blue"><span>Active Rooms</span><strong>${fmtNum(t.activeMatches)}</strong><small>30 Hz target loop</small></div>
      <div class="kpi-card"><span>Real Sim Tick</span><strong>${t.serverTickMs ?? 0} ms</strong><small>Process CPU: ${t.cpuUsagePercent ?? 0}%</small></div>
      <div class="kpi-card"><span>RSS Memory</span><strong>${fmtNum(t.memoryUsageMb)} MB</strong><small>Uptime: ${fmtTime(t.uptimeSeconds)}</small></div>
      <div class="kpi-card accent-gold"><span>DAU / WAU / MAU</span><strong>${fmtNum(u.dau)} / ${fmtNum(u.wau)} / ${fmtNum(u.mau)}</strong><small>${fmtNum(u.totalRegisteredUsers)} registered + ${fmtNum(u.totalGuests)} guests</small></div>
      <div class="kpi-card"><span>Total Matches Logged</span><strong>${fmtNum(g.totalGamesPlayed)}</strong><small>${g.completionRate ?? 0}% completion</small></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h3>Real-Time Server Health</h3>
      <p class="subtitle">All telemetry figures are measured directly from live Node CPU deltas, process RSS memory, room simulation timings, and persisted SQLite records.</p>
      <div class="stat-row-list">
        <div><span>Tick Target</span><b>${t.serverTickRateHz || 30} Hz (33.3 ms budget)</b></div>
        <div><span>Observed Tick Latency</span><b>${t.serverTickMs ?? 0} ms</b></div>
        <div><span>Anti-Cheat Alerts Logged</span><b>${fmtNum(t.antiCheatFlagsCount)}</b></div>
        <div><span>Total Gameplay Hours Recorded</span><b>${g.totalGameplayHours ?? 0} hrs</b></div>
      </div>
      ${portal.adminUser?.role === 'super_admin' ? `
        <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-top:12px;border-top:1px solid var(--border)">
          <small class="muted">Create a consistent hot SQLite backup (<code>VACUUM INTO</code>) on the server volume.</small>
          <button id="adm-backup-btn" class="btn btn-sm btn-primary">💾 Create Hot SQLite Backup</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAnalyticsTab(): string {
  const ov = portal.overview;
  if (!ov) return `<div class="panel"><p>Loading live analytics…</p></div>`;
  const { users: u, gameplay: g, retention: r } = ov;

  return `
    <section class="panel">
      <h3>A. User Analytics</h3>
      <div class="kpi-grid">
        <div class="kpi-card accent-blue"><span>Total Players</span><strong>${fmtNum(u.totalUsers)}</strong><small>${fmtNum(u.totalRegisteredUsers)} registered · ${fmtNum(u.totalGuests)} guests</small></div>
        <div class="kpi-card accent-green"><span>Active Users (MAU)</span><strong>${fmtNum(u.mau)}</strong><small>DAU ${fmtNum(u.dau)} · WAU ${fmtNum(u.wau)}</small></div>
        <div class="kpi-card"><span>New Signups</span><strong>+${fmtNum(u.newUsersToday)} today</strong><small>+${fmtNum(u.newUsersThisWeek)} week · +${fmtNum(u.newUsersThisMonth)} 30d</small></div>
        <div class="kpi-card"><span>Returning Users (30d)</span><strong>${fmtNum(u.returningUsers)}</strong><small>${fmtNum(u.inactiveUsers)} inactive users (&gt;30d)</small></div>
      </div>
    </section>

    <section class="panel">
      <h3>B. Gameplay Analytics</h3>
      <div class="kpi-grid">
        <div class="kpi-card accent-gold"><span>Total Games Played</span><strong>${fmtNum(g.totalGamesPlayed)}</strong><small>${fmtNum(g.totalGameplaySessions)} sessions</small></div>
        <div class="kpi-card"><span>Total Playtime</span><strong>${g.totalGameplayHours} hrs</strong><small>Avg ${fmtTime(g.avgSessionDurationSeconds)} / match</small></div>
        <div class="kpi-card accent-green"><span>Completion vs Abandonment</span><strong>${g.completionRate}% / ${g.abandonmentRate}%</strong><small>${fmtNum(g.completedGames)} completed · ${fmtNum(g.abandonedGames)} abandoned</small></div>
        <div class="kpi-card accent-blue"><span>Scores &amp; Mode Peak</span><strong>Avg ${fmtNum(g.avgScore)}</strong><small>High: ${fmtNum(g.highestScore)} · Top: ${esc(g.mostPopularMode)}</small></div>
      </div>
      <div class="charts-two-col" style="margin-top:14px">
        ${renderDonutChart('Mode Usage Split (Recorded Matches)', [
          { label: 'Story / Explorer / Boss', value: g.storyModeUsage, color: '#32C766' },
          { label: 'Classic / Event / Arcade', value: g.gameModeUsage, color: '#3B9EFF' },
          { label: 'Multiplayer (BR / Team)', value: g.multiplayerModeUsage, color: '#F59E0B' },
        ])}
        ${renderDonutChart('Active Player Split (Last 7 Days)', [
          { label: 'New Players', value: r.newPlayersCount, color: '#10B981' },
          { label: 'Returning Players', value: r.returningPlayersCount, color: '#8B5CF6' },
        ])}
      </div>
      ${g.modeBreakdown?.length ? `
        <div class="table-scroll" style="margin-top:14px">
          <table class="data-table">
            <thead><tr><th>Mode</th><th>Games</th><th>Completed</th><th>Abandoned</th><th>Avg Score</th><th>High Score</th><th>Hours</th></tr></thead>
            <tbody>
              ${g.modeBreakdown.map((m: any) => `
                <tr>
                  <td><b>${esc(m.mode)}</b></td>
                  <td>${fmtNum(m.games)}</td>
                  <td>${fmtNum(m.completed)}</td>
                  <td>${fmtNum(m.abandoned)}</td>
                  <td>${fmtNum(m.avgScore)}</td>
                  <td>${fmtNum(m.highestScore)}</td>
                  <td>${m.hours}h</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </section>

    <section class="panel">
      <h3>C. Cohort Retention Analytics</h3>
      <div class="kpi-grid" style="margin-bottom:14px">
        <div class="kpi-card accent-green"><span>Day 1 Retention</span><strong>${r.day1Retention}%</strong><small>${r.cohorts.day1.retained}/${r.cohorts.day1.eligible} cohort</small></div>
        <div class="kpi-card accent-blue"><span>Day 7 Retention</span><strong>${r.day7Retention}%</strong><small>${r.cohorts.day7.retained}/${r.cohorts.day7.eligible} cohort</small></div>
        <div class="kpi-card"><span>Day 30 Retention</span><strong>${r.day30Retention}%</strong><small>${r.cohorts.day30.retained}/${r.cohorts.day30.eligible} cohort</small></div>
        <div class="kpi-card accent-gold"><span>Returning Rate (7d)</span><strong>${r.returningPlayerPercentage}%</strong><small>${r.activeSampleSize} active sampled</small></div>
      </div>
      ${renderRetentionBars(r)}
    </section>
  `;
}

function renderReportsTab(): string {
  const rep = portal.report;
  const periods: Array<{ id: AdminPortalState['reportPeriod']; label: string }> = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
    { id: 'custom', label: 'Custom Range' },
  ];
  return `
    <section class="panel">
      <div class="report-toolbar">
        <div class="pill-group">
          ${periods.map(p => `<button class="btn btn-sm ${portal.reportPeriod === p.id ? 'btn-primary' : 'btn-soft'}" data-rep-period="${p.id}">${p.label}</button>`).join('')}
        </div>
        <div class="report-dates">
          ${portal.reportPeriod === 'custom' ? `
            <input type="date" id="rep-start" value="${esc(portal.reportStart)}" />
            <span>to</span>
            <input type="date" id="rep-end" value="${esc(portal.reportEnd)}" />
            <button id="rep-apply" class="btn btn-sm btn-primary">Apply</button>
          ` : `<span class="muted">Window: ${esc(rep?.startDate || '')} → ${esc(rep?.endDate || '')}</span>`}
          <button id="rep-csv" class="btn btn-sm btn-gold">⬇ Export CSV</button>
        </div>
      </div>

      ${rep ? `
        <div class="kpi-grid" style="margin-top:14px">
          <div class="kpi-card accent-blue"><span>Active Users</span><strong>${fmtNum(rep.summary.activeUsers)}</strong><small>+${fmtNum(rep.summary.newUsers)} new</small></div>
          <div class="kpi-card accent-green"><span>Games Played</span><strong>${fmtNum(rep.summary.gamesPlayed)}</strong><small>${rep.summary.completionRate}% completed</small></div>
          <div class="kpi-card accent-gold"><span>Avg / High Score</span><strong>${fmtNum(rep.summary.avgScore)}</strong><small>Peak ${fmtNum(rep.summary.highestScore)} · ${rep.summary.totalGameplayHours}h</small></div>
          <div class="kpi-card"><span>Ads Performance</span><strong>${fmtNum(rep.summary.adImpressions)} imps</strong><small>${fmtNum(rep.summary.adClicks)} clicks</small></div>
        </div>

        <div class="charts-two-col" style="margin-top:14px">
          ${renderTrendChart('DAU & New Users', rep.series.map((s: any) => ({ label: s.bucket, primary: s.dau, secondary: s.newUsers })), {
            primaryLabel: 'DAU', secondaryLabel: 'New Users', primaryColor: '#3B9EFF', secondaryColor: '#10B981',
          })}
          ${renderTrendChart('Games Completed vs Abandoned', rep.series.map((s: any) => ({ label: s.bucket, primary: s.completedGames, secondary: s.abandonedGames })), {
            primaryLabel: 'Completed', secondaryLabel: 'Abandoned', primaryColor: '#32C766', secondaryColor: '#EF4444',
          })}
        </div>

        <div class="table-scroll" style="margin-top:14px">
          <table class="data-table">
            <thead><tr><th>Date</th><th>DAU</th><th>New</th><th>Games</th><th>Completed</th><th>Abandoned</th><th>Avg Score</th><th>Hours</th><th>Impr</th><th>Clicks</th></tr></thead>
            <tbody>
              ${rep.series.map((s: any) => `
                <tr>
                  <td>${esc(s.bucket)}</td>
                  <td>${s.dau}</td>
                  <td>${s.newUsers}</td>
                  <td>${s.gamesPlayed}</td>
                  <td>${s.completedGames}</td>
                  <td>${s.abandonedGames}</td>
                  <td>${s.avgScore}</td>
                  <td>${s.gameplayHours}</td>
                  <td>${s.adImpressions}</td>
                  <td>${s.adClicks}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p>Loading report…</p>'}
    </section>
  `;
}

function renderAdsTab(): string {
  const d = portal.adDraft;
  const previewSrc = safeUrl(resolveMediaUrl(d.mediaUrl));
  const placements = [
    { id: 'home_screen', label: 'Home Screen Banner' },
    { id: 'between_sessions', label: 'Between Game Sessions' },
    { id: 'game_over', label: 'Game-Over / Results Card' },
    { id: 'story_menu', label: 'Story Mode Menu' },
    { id: 'rewarded_opt_in', label: 'Rewarded Video / Opt-In Bonus' },
  ];

  return `
    <div class="admin-split">
      <section class="panel">
        <h3>${portal.editingAdId ? 'Edit Advertisement' : 'Create Advertisement'}</h3>
        <form id="ad-cms-form" class="stack-form">
          <label>Ad Title *
            <input id="ad-title" type="text" required maxlength="80" value="${esc(d.title)}" placeholder="Spring Tournament Live" />
          </label>
          <label>Description
            <textarea id="ad-desc" rows="2" maxlength="300" placeholder="Short description shown under creative">${esc(d.description)}</textarea>
          </label>
          <div class="form-row-2">
            <label>Placement *
              <select id="ad-placement">
                ${placements.map(p => `<option value="${p.id}" ${d.placement === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select>
            </label>
            <label>Media Type
              <select id="ad-media-type">
                <option value="image" ${d.mediaType === 'image' ? 'selected' : ''}>Image (PNG/JPG/GIF/WEBP)</option>
                <option value="video" ${d.mediaType === 'video' ? 'selected' : ''}>Video (MP4/WEBM)</option>
              </select>
            </label>
          </div>
          <label>Upload Creative Asset (Max 5MB Image / 20MB Video)
            <input id="ad-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm" />
          </label>
          <label>Or Creative URL / Uploaded Asset Path *
            <input id="ad-media-url" type="text" required value="${esc(d.mediaUrl)}" placeholder="/uploads/ads/... or https://..." />
          </label>
          <label>Destination URL (https://...)
            <input id="ad-dest-url" type="url" value="${esc(d.destinationUrl)}" placeholder="https://example.com/promo" />
          </label>
          <div class="form-row-2">
            <label>Schedule Start *
              <input id="ad-starts" type="datetime-local" required value="${esc(d.startsAt)}" />
            </label>
            <label>Schedule End *
              <input id="ad-ends" type="datetime-local" required value="${esc(d.endsAt)}" />
            </label>
          </div>
          <label class="checkbox-inline">
            <input id="ad-enabled" type="checkbox" ${d.enabled ? 'checked' : ''} />
            <span>Enable advertisement when schedule is active</span>
          </label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" ${portal.uploadBusy ? 'disabled' : ''}>
              ${portal.uploadBusy ? 'Uploading…' : (portal.editingAdId ? 'Save Changes' : 'Publish Advertisement')}
            </button>
            ${portal.editingAdId ? `<button type="button" id="ad-cancel-edit" class="btn btn-soft">Cancel Edit</button>` : ''}
          </div>
        </form>
      </section>

      <section class="panel">
        <h3>Live Creative Preview</h3>
        <p class="subtitle">Verify visual framing before publishing. Active gameplay is never interrupted by ads.</p>
        <div class="ad-preview-box">
          ${previewSrc ? `
            <div class="ad-card">
              <span class="ad-badge">SPONSORED · ${esc(d.placement)}</span>
              <div class="ad-media-wrap">
                ${d.mediaType === 'video'
                  ? `<video class="ad-media" src="${esc(previewSrc)}" controls muted loop playsinline></video>`
                  : `<img class="ad-media" src="${esc(previewSrc)}" alt="Ad preview" />`}
              </div>
              <div class="ad-copy">
                <strong>${esc(d.title || 'Advertisement Title')}</strong>
                <p>${esc(d.description || 'Description preview will appear here.')}</p>
              </div>
              ${d.destinationUrl ? `<span class="btn btn-sm ad-cta">Visit ↗</span>` : ''}
            </div>
          ` : `<div class="empty-msg">Upload an image/video or paste a URL to preview the advertisement card.</div>`}
        </div>
      </section>
    </div>

    <section class="panel" style="margin-top:16px">
      <h3>Active &amp; Scheduled Advertisements (${portal.ads.length})</h3>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Title</th><th>Placement</th><th>Schedule</th><th>Status</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Actions</th></tr></thead>
          <tbody>
            ${portal.ads.map(ad => {
              const now = Date.now();
              const active = ad.enabled && Date.parse(ad.startsAt) <= now && Date.parse(ad.endsAt) >= now;
              const expired = Date.parse(ad.endsAt) < now;
              const statusLbl = !ad.enabled ? 'Disabled' : expired ? 'Expired' : active ? 'Live' : 'Scheduled';
              return `
                <tr>
                  <td><b>${esc(ad.title)}</b><br/><small>${esc(ad.mediaType)} · ${esc(ad.destinationUrl || 'No link')}</small></td>
                  <td><span class="pill">${esc(ad.placement)}</span></td>
                  <td><small>${esc(ad.startsAt.slice(0, 10))} → ${esc(ad.endsAt.slice(0, 10))}</small></td>
                  <td><span class="pill pill-${statusLbl.toLowerCase()}">${statusLbl}</span></td>
                  <td>${fmtNum(ad.impressions)}</td>
                  <td>${fmtNum(ad.clicks)}</td>
                  <td><b>${ad.ctr ?? 0}%</b></td>
                  <td class="btn-cell">
                    <button class="btn btn-xs btn-soft" data-ad-toggle="${esc(ad.id)}" data-enable="${ad.enabled ? '0' : '1'}">${ad.enabled ? 'Disable' : 'Enable'}</button>
                    <button class="btn btn-xs btn-soft" data-ad-edit="${esc(ad.id)}">Edit</button>
                    <button class="btn btn-xs btn-danger" data-ad-del="${esc(ad.id)}">Delete</button>
                  </td>
                </tr>
              `;
            }).join('') || `<tr><td colspan="8" class="empty-cell">No advertisements created yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderUsersTab(): string {
  const isSuper = portal.adminUser?.role === 'super_admin';
  return `
    <section class="panel">
      <div class="users-filter-bar">
        <input id="usr-search" type="search" value="${esc(portal.userSearch)}" placeholder="Search username, email, display name…" />
        <select id="usr-role">
          <option value="">All Roles</option>
          <option value="player" ${portal.userRoleFilter === 'player' ? 'selected' : ''}>Player</option>
          <option value="admin" ${portal.userRoleFilter === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="super_admin" ${portal.userRoleFilter === 'super_admin' ? 'selected' : ''}>Super Admin</option>
        </select>
        <select id="usr-status">
          <option value="">All Statuses</option>
          <option value="active" ${portal.userStatusFilter === 'active' ? 'selected' : ''}>Active</option>
          <option value="disabled" ${portal.userStatusFilter === 'disabled' ? 'selected' : ''}>Disabled</option>
          <option value="banned" ${portal.userStatusFilter === 'banned' ? 'selected' : ''}>Banned</option>
        </select>
        <button id="usr-filter-go" class="btn btn-sm btn-primary">Filter</button>
      </div>

      <div class="table-scroll" style="margin-top:12px">
        <table class="data-table">
          <thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Lv / High Score</th><th>Stars / Matches</th><th>Last Active</th><th>Moderation</th></tr></thead>
          <tbody>
            ${portal.usersData.users.map(u => `
              <tr>
                <td><b>${esc(u.username)}</b>${u.isGuest ? ' <span class="pill">Guest</span>' : ''}<br/><small>${esc(u.email || u.id)}</small></td>
                <td><span class="pill">${esc(u.role)}</span></td>
                <td><span class="pill pill-${u.status === 'active' ? 'live' : 'expired'}">${esc(u.status)}</span></td>
                <td>Lv.${u.level} · ${fmtNum(u.highestScore)}</td>
                <td>${fmtNum(u.stars)}★ · ${fmtNum(u.matchesPlayed)} matches</td>
                <td><small>${u.lastActiveAt ? esc(u.lastActiveAt.slice(0, 16).replace('T', ' ')) : '—'}</small></td>
                <td class="btn-cell">
                  ${u.id !== portal.adminUser?.id && u.role !== 'super_admin' ? `
                    ${u.status !== 'active'
                      ? `<button class="btn btn-xs btn-primary" data-user-status="${esc(u.id)}" data-status="active">Activate</button>`
                      : `<button class="btn btn-xs btn-soft" data-user-status="${esc(u.id)}" data-status="disabled">Disable</button>
                         <button class="btn btn-xs btn-danger" data-user-status="${esc(u.id)}" data-status="banned">Ban</button>`}
                  ` : '<small class="muted">Protected</small>'}
                </td>
              </tr>
            `).join('') || `<tr><td colspan="7" class="empty-cell">No matching accounts.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel" style="margin-top:16px">
      <h3>Administrator Accounts (${portal.adminsList.length})</h3>
      <div class="table-scroll" style="margin-bottom:14px">
        <table class="data-table">
          <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th></tr></thead>
          <tbody>
            ${portal.adminsList.map(a => `
              <tr>
                <td><b>${esc(a.username)}</b></td>
                <td>${esc(a.email)}</td>
                <td><span class="pill">${esc(a.role)}</span></td>
                <td>${esc(a.status)}</td>
                <td><small>${a.lastLoginAt ? esc(a.lastLoginAt.slice(0, 16).replace('T', ' ')) : 'Never'}</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${isSuper ? `
        <form id="create-admin-form" class="stack-form">
          <h4>Provision New Administrator (Super Admin Only)</h4>
          <div class="form-row-2">
            <input id="new-adm-user" type="text" required minlength="3" maxlength="24" placeholder="Username (A-Z, 0-9, _)" />
            <input id="new-adm-email" type="email" required placeholder="admin@domain.com" />
          </div>
          <div class="form-row-2">
            <input id="new-adm-pass" type="password" required minlength="8" placeholder="Password (min 8 characters)" />
            <select id="new-adm-role">
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Provision Admin Account</button>
        </form>
      ` : `<p class="muted">Signed in as <b>admin</b>. Only a <b>super_admin</b> may provision additional administrator accounts.</p>`}
    </section>
  `;
}

function renderCouponsTab(): string {
  return `
    <div class="admin-split">
      <section class="panel">
        <h3>Create Park Coupon</h3>
        <form id="cpn-form" class="stack-form">
          <input id="cpn-title" type="text" required placeholder="Coupon title (e.g. Explorer Bonus)" />
          <input id="cpn-store" type="text" required placeholder="Partner / Store Label" />
          <div class="form-row-2">
            <input id="cpn-discount" type="text" required placeholder="Reward text (e.g. 500 Bonus Stars)" value="Special Promo" />
            <input id="cpn-cost" type="number" min="0" value="0" placeholder="Star cost" />
          </div>
          <div class="form-row-2">
            <input id="cpn-level" type="number" min="1" value="1" placeholder="Min level" />
            <input id="cpn-expiry" type="date" value="2026-12-31" />
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Create Coupon</button>
        </form>
      </section>
      <section class="panel">
        <h3>Coupons (${portal.coupons.length})</h3>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Title</th><th>Partner</th><th>Uses</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${portal.coupons.map(c => `
                <tr>
                  <td>${esc(c.title)}</td>
                  <td>${esc(c.storeName)}</td>
                  <td>${c.redemptionCount}/${c.redemptionLimit < 0 ? '∞' : c.redemptionLimit}</td>
                  <td>${c.enabled ? 'Enabled' : 'Disabled'}</td>
                  <td>
                    <button class="btn btn-xs btn-soft" data-cpn-toggle="${esc(c.id)}" data-enable="${c.enabled ? '0' : '1'}">${c.enabled ? 'Disable' : 'Enable'}</button>
                    <button class="btn btn-xs btn-danger" data-cpn-del="${esc(c.id)}">Del</button>
                  </td>
                </tr>
              `).join('') || `<tr><td colspan="5">No coupons configured.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderAuditTab(): string {
  return `
    <div class="admin-split">
      <section class="panel">
        <h3>Admin Activity Audit Log</h3>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>
              ${(portal.audit.adminLogs || []).map(l => `
                <tr>
                  <td><small>${esc(String(l.createdAt).slice(0, 19).replace('T', ' '))}</small></td>
                  <td><b>${esc(l.adminUsername || l.adminId)}</b></td>
                  <td><span class="pill">${esc(l.action)}</span></td>
                  <td><small>${esc(l.targetId || JSON.stringify(l.details || {}))}</small></td>
                </tr>
              `).join('') || `<tr><td colspan="4">No admin audit events recorded yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <h3>Anti-Cheat Flags</h3>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Time</th><th>Player</th><th>Rule</th><th>Severity</th><th>Details</th></tr></thead>
            <tbody>
              ${(portal.audit.antiCheatLogs || []).map(l => `
                <tr>
                  <td><small>${esc(String(l.timestamp).slice(0, 19).replace('T', ' '))}</small></td>
                  <td><small>${esc(l.userId)}</small></td>
                  <td><b>${esc(l.rule)}</b></td>
                  <td><span class="pill">${esc(l.severity)}</span></td>
                  <td><small>${esc(l.details)}</small></td>
                </tr>
              `).join('') || `<tr><td colspan="5">Zero anti-cheat flags recorded.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function bindAdminEvents(root: HTMLElement, ctx: AppContext) {
  root.querySelectorAll<HTMLElement>('[data-tab]').forEach(btn => {
    btn.addEventListener('click', async () => {
      portal.tab = btn.dataset.tab as AdminTab;
      await loadTabData(portal.tab);
      renderAdminScreen(root, ctx);
    });
  });

  root.querySelector('#adm-refresh')?.addEventListener('click', async () => {
    await loadTabData(portal.tab);
    renderAdminScreen(root, ctx);
  });
  root.querySelector('#adm-backup-btn')?.addEventListener('click', async () => {
    const res = await adminApi('/api/admin/system/backup', { method: 'POST' });
    if (!res.ok) {
      ctx.toast(res.data?.error || 'Backup failed');
      return;
    }
    const kb = Math.round((res.data.sizeBytes || 0) / 1024);
    ctx.toast(`Hot SQLite backup saved (${fmtNum(kb)} KB)`);
  });
  root.querySelector('#adm-to-game')?.addEventListener('click', () => ctx.setScreen('app'));
  root.querySelector('#adm-logout')?.addEventListener('click', async () => {
    await adminApi('/api/admin/auth/logout', { method: 'POST' });
    setAdminToken(null);
    portal.adminUser = null;
    renderAdminScreen(root, ctx);
  });

  // Reports
  root.querySelectorAll<HTMLElement>('[data-rep-period]').forEach(btn => {
    btn.addEventListener('click', async () => {
      portal.reportPeriod = btn.dataset.repPeriod as any;
      await loadTabData('reports');
      renderAdminScreen(root, ctx);
    });
  });
  root.querySelector('#rep-apply')?.addEventListener('click', async () => {
    portal.reportStart = (root.querySelector('#rep-start') as HTMLInputElement).value;
    portal.reportEnd = (root.querySelector('#rep-end') as HTMLInputElement).value;
    await loadTabData('reports');
    renderAdminScreen(root, ctx);
  });
  root.querySelector('#rep-csv')?.addEventListener('click', async () => {
    const q = new URLSearchParams({ period: portal.reportPeriod });
    if (portal.reportPeriod === 'custom') {
      q.set('startDate', portal.reportStart);
      q.set('endDate', portal.reportEnd);
    }
    const res = await fetch(`${SERVER_URL}/api/admin/analytics/reports/export?${q.toString()}`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    });
    if (!res.ok) { ctx.toast('CSV export failed'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `anaconda-report-${portal.reportPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    ctx.toast('Exported CSV report');
  });

  // Ads CMS
  const syncDraftFromDom = () => {
    const t = root.querySelector('#ad-title') as HTMLInputElement | null;
    if (!t) return;
    portal.adDraft = {
      title: t.value,
      description: (root.querySelector('#ad-desc') as HTMLTextAreaElement)?.value || '',
      mediaUrl: (root.querySelector('#ad-media-url') as HTMLInputElement)?.value || '',
      mediaType: ((root.querySelector('#ad-media-type') as HTMLSelectElement)?.value as 'image' | 'video') || 'image',
      destinationUrl: (root.querySelector('#ad-dest-url') as HTMLInputElement)?.value || '',
      placement: (root.querySelector('#ad-placement') as HTMLSelectElement)?.value || 'home_screen',
      enabled: !!(root.querySelector('#ad-enabled') as HTMLInputElement)?.checked,
      startsAt: (root.querySelector('#ad-starts') as HTMLInputElement)?.value || nowLocalInput(0),
      endsAt: (root.querySelector('#ad-ends') as HTMLInputElement)?.value || nowLocalInput(30),
    };
  };

  root.querySelector('#ad-file')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    syncDraftFromDom();
    portal.uploadBusy = true;
    renderAdminScreen(root, ctx);
    const up = await adminUploadFile(file);
    portal.uploadBusy = false;
    if (!up.ok) {
      ctx.toast(up.error || 'Upload rejected');
    } else {
      portal.adDraft.mediaUrl = up.mediaUrl || '';
      portal.adDraft.mediaType = up.mediaType || 'image';
      ctx.toast('Creative asset uploaded & validated');
    }
    renderAdminScreen(root, ctx);
  });

  ['#ad-title', '#ad-desc', '#ad-media-url', '#ad-dest-url', '#ad-placement', '#ad-media-type'].forEach(sel => {
    root.querySelector(sel)?.addEventListener('input', syncDraftFromDom);
  });

  root.querySelector('#ad-cancel-edit')?.addEventListener('click', () => {
    portal.editingAdId = null;
    portal.adDraft = { title: '', description: '', mediaUrl: '', mediaType: 'image', destinationUrl: '', placement: 'home_screen', enabled: true, startsAt: nowLocalInput(0), endsAt: nowLocalInput(30) };
    renderAdminScreen(root, ctx);
  });

  root.querySelector('#ad-cms-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    syncDraftFromDom();
    const payload = {
      ...portal.adDraft,
      startsAt: new Date(portal.adDraft.startsAt).toISOString(),
      endsAt: new Date(portal.adDraft.endsAt).toISOString(),
    };
    const r = portal.editingAdId
      ? await adminApi(`/api/admin/ads/${portal.editingAdId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await adminApi('/api/admin/ads', { method: 'POST', body: JSON.stringify(payload) });
    if (!r.ok) { ctx.toast(r.data?.error || 'Could not save advertisement'); return; }
    ctx.toast(portal.editingAdId ? 'Advertisement updated' : 'Advertisement published');
    portal.editingAdId = null;
    portal.adDraft = { title: '', description: '', mediaUrl: '', mediaType: 'image', destinationUrl: '', placement: 'home_screen', enabled: true, startsAt: nowLocalInput(0), endsAt: nowLocalInput(30) };
    await loadTabData('ads');
    renderAdminScreen(root, ctx);
  });

  root.querySelectorAll<HTMLElement>('[data-ad-toggle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.adToggle!;
      const enable = btn.dataset.enable === '1';
      await adminApi(`/api/admin/ads/${id}/${enable ? 'enable' : 'disable'}`, { method: 'POST' });
      await loadTabData('ads');
      renderAdminScreen(root, ctx);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-ad-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ad = portal.ads.find(a => a.id === btn.dataset.adEdit);
      if (!ad) return;
      portal.editingAdId = ad.id;
      portal.adDraft = {
        title: ad.title,
        description: ad.description || '',
        mediaUrl: ad.mediaUrl,
        mediaType: ad.mediaType,
        destinationUrl: ad.destinationUrl || '',
        placement: ad.placement,
        enabled: ad.enabled,
        startsAt: String(ad.startsAt).slice(0, 16),
        endsAt: String(ad.endsAt).slice(0, 16),
      };
      renderAdminScreen(root, ctx);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-ad-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi(`/api/admin/ads/${btn.dataset.adDel}`, { method: 'DELETE' });
      ctx.toast('Advertisement deleted');
      await loadTabData('ads');
      renderAdminScreen(root, ctx);
    });
  });

  // Users & Admins
  root.querySelector('#usr-filter-go')?.addEventListener('click', async () => {
    portal.userSearch = (root.querySelector('#usr-search') as HTMLInputElement).value.trim();
    portal.userRoleFilter = (root.querySelector('#usr-role') as HTMLSelectElement).value;
    portal.userStatusFilter = (root.querySelector('#usr-status') as HTMLSelectElement).value;
    await loadTabData('users');
    renderAdminScreen(root, ctx);
  });

  root.querySelectorAll<HTMLElement>('[data-user-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.userStatus!;
      const status = btn.dataset.status!;
      const r = await adminApi(`/api/admin/users/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      ctx.toast(r.ok ? `Account set to ${status}` : (r.data?.error || 'Update failed'));
      await loadTabData('users');
      renderAdminScreen(root, ctx);
    });
  });

  root.querySelector('#create-admin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await adminApi('/api/admin/admins', {
      method: 'POST',
      body: JSON.stringify({
        username: (root.querySelector('#new-adm-user') as HTMLInputElement).value.trim(),
        email: (root.querySelector('#new-adm-email') as HTMLInputElement).value.trim(),
        password: (root.querySelector('#new-adm-pass') as HTMLInputElement).value,
        role: (root.querySelector('#new-adm-role') as HTMLSelectElement).value,
      }),
    });
    if (!r.ok) { ctx.toast(r.data?.error || 'Failed to create admin'); return; }
    ctx.toast(`Provisioned admin ${r.data.user.username}`);
    await loadTabData('users');
    renderAdminScreen(root, ctx);
  });

  // Coupons
  root.querySelector('#cpn-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await adminApi('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify({
        title: (root.querySelector('#cpn-title') as HTMLInputElement).value.trim(),
        storeName: (root.querySelector('#cpn-store') as HTMLInputElement).value.trim(),
        discountText: (root.querySelector('#cpn-discount') as HTMLInputElement).value.trim(),
        costStars: Number((root.querySelector('#cpn-cost') as HTMLInputElement).value) || 0,
        minLevel: Number((root.querySelector('#cpn-level') as HTMLInputElement).value) || 1,
        expiryDate: (root.querySelector('#cpn-expiry') as HTMLInputElement).value || '2026-12-31',
      }),
    });
    ctx.toast(r.ok ? 'Coupon created' : (r.data?.error || 'Coupon error'));
    await loadTabData('coupons');
    renderAdminScreen(root, ctx);
  });
  root.querySelectorAll<HTMLElement>('[data-cpn-toggle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const enable = btn.dataset.enable === '1';
      await adminApi(`/api/admin/coupons/${btn.dataset.cpnToggle}/${enable ? 'enable' : 'disable'}`, { method: 'POST' });
      await loadTabData('coupons');
      renderAdminScreen(root, ctx);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-cpn-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi(`/api/admin/coupons/${btn.dataset.cpnDel}`, { method: 'DELETE' });
      await loadTabData('coupons');
      renderAdminScreen(root, ctx);
    });
  });

  // RPG Question Bank & Overrides CMS
  root.querySelector('#rpg-q-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const options = (root.querySelector('#rpg-q-opts') as HTMLInputElement).value
      .split(',').map(s => s.trim()).filter(Boolean);
    const r = await adminApi('/api/admin/content/questions', {
      method: 'POST',
      body: JSON.stringify({
        category: (root.querySelector('#rpg-q-cat') as HTMLSelectElement).value,
        difficulty: Number((root.querySelector('#rpg-q-diff') as HTMLInputElement).value) || 1,
        prompt: (root.querySelector('#rpg-q-prompt') as HTMLInputElement).value.trim(),
        options,
        correctAnswer: (root.querySelector('#rpg-q-ans') as HTMLInputElement).value.trim(),
        explanation: (root.querySelector('#rpg-q-exp') as HTMLInputElement).value.trim(),
        status: (root.querySelector('#rpg-q-status') as HTMLSelectElement).value,
      }),
    });
    if (!r.ok) { ctx.toast(r.data?.error || 'Could not save question'); return; }
    ctx.toast(`Question saved (${r.data.question?.questionId})`);
    await loadTabData('rpg');
    renderAdminScreen(root, ctx);
  });
  root.querySelectorAll<HTMLElement>('[data-rpg-q-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi(`/api/admin/content/questions/${encodeURIComponent(btn.dataset.rpgQDel!)}`, { method: 'DELETE' });
      ctx.toast('Question removed');
      await loadTabData('rpg');
      renderAdminScreen(root, ctx);
    });
  });
  root.querySelector('#rpg-ov-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    let payload: any;
    try {
      payload = JSON.parse((root.querySelector('#rpg-ov-json') as HTMLTextAreaElement).value);
    } catch {
      ctx.toast('Invalid JSON payload');
      return;
    }
    const r = await adminApi('/api/admin/content/overrides', {
      method: 'PUT',
      body: JSON.stringify({
        entityType: (root.querySelector('#rpg-ov-type') as HTMLSelectElement).value,
        entityId: (root.querySelector('#rpg-ov-id') as HTMLInputElement).value.trim(),
        status: (root.querySelector('#rpg-ov-status') as HTMLSelectElement).value,
        payload,
      }),
    });
    if (!r.ok) { ctx.toast(r.data?.error || 'Override rejected'); return; }
    portal.rpgOverridePreview = r.data.preview || r.data.override;
    ctx.toast('Override saved & preview updated');
    await loadTabData('rpg');
    renderAdminScreen(root, ctx);
  });
  root.querySelectorAll<HTMLElement>('[data-rpg-ov-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [type, id] = (btn.dataset.rpgOvDel || '').split('::');
      if (!type || !id) return;
      await adminApi(`/api/admin/content/overrides/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      ctx.toast('Override removed');
      await loadTabData('rpg');
      renderAdminScreen(root, ctx);
    });
  });
}

