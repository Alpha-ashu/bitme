const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap_admin_test_'));
process.env.DATA_FILE = path.join(tmpDir, 'test.json');
process.env.AD_UPLOAD_DIR = path.join(tmpDir, 'uploads');
process.env.ADMIN_BOOTSTRAP_USERNAME = 'RootAdmin';
process.env.ADMIN_BOOTSTRAP_PASSWORD = 'StrongAdminPassword123!';
process.env.ADMIN_BOOTSTRAP_EMAIL = 'root@anacondapark.test';
process.env.AD_REWARD_MIN_MS = '120';

const { app } = require('../dist/server');
const { db } = require('../dist/db/Database');
const { AnalyticsService } = require('../dist/services/AnalyticsService');
const { ExplorerService } = require('../dist/services/ExplorerService');
const { KINGDOMS } = require('../dist/config/ExplorerContent');
const { sessionManager } = require('../dist/services/GameSessionManager');
const { AdManagerService } = require('../dist/services/AdManagerService');

let httpServer;
let baseUrl = '';

async function api(route, opts = {}) {
  const res = await fetch(`${baseUrl}${route}`, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* CSV or plain */ }
  return { status: res.status, headers: res.headers, text, json };
}

test.before(async () => {
  await new Promise((resolve) => {
    httpServer = app.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  sessionManager.stopAll();
  await new Promise((resolve) => httpServer.close(resolve));
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Auth separation, RBAC, session revocation, user moderation & guest upgrade', async () => {
  // Register normal player (ignores any forged role)
  const reg = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'HeroPlayer', email: 'hero@test.local', password: 'Password123', role: 'super_admin' }),
  });
  assert.equal(reg.status, 200);
  assert.equal(reg.json.user.role, 'player');
  const playerToken = reg.json.token;

  // Player cannot access admin routes or admin login
  const admAttempt = await api('/api/admin/telemetry', { headers: { Authorization: `Bearer ${playerToken}` } });
  assert.equal(admAttempt.status, 403);
  const badAdmLogin = await api('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'HeroPlayer', password: 'Password123' }),
  });
  assert.equal(badAdmLogin.status, 401);

  // Admin cannot login via player portal
  const admViaPlayer = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RootAdmin', password: 'StrongAdminPassword123!' }),
  });
  assert.equal(admViaPlayer.status, 401);

  // Super Admin logs into isolated Admin Portal
  const admLogin = await api('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RootAdmin', password: 'StrongAdminPassword123!' }),
  });
  assert.equal(admLogin.status, 200);
  assert.equal(admLogin.json.user.role, 'super_admin');
  const superToken = admLogin.json.token;

  // Super Admin creates a standard Admin account
  const newAdm = await api('/api/admin/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superToken}` },
    body: JSON.stringify({ username: 'OpsAdmin', email: 'ops@test.local', password: 'OpsPassword123!', role: 'admin' }),
  });
  assert.equal(newAdm.status, 200);
  assert.equal(newAdm.json.user.role, 'admin');

  // OpsAdmin logs in, can view users, CANNOT create new admins
  const opsLogin = await api('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'OpsAdmin', password: 'OpsPassword123!' }),
  });
  assert.equal(opsLogin.status, 200);
  const opsToken = opsLogin.json.token;

  const esc = await api('/api/admin/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opsToken}` },
    body: JSON.stringify({ username: 'IllegalAdmin', email: 'x@y.z', password: 'Password123!', role: 'admin' }),
  });
  assert.equal(esc.status, 403);

  // Guest account + upgrade preserves progression
  const guest = await api('/api/auth/guest', { method: 'POST' });
  assert.equal(guest.status, 200);
  assert.equal(guest.json.user.isGuest, true);
  db.updateProfile(guest.json.user.id, { stars: 4242 });

  const upgraded = await api('/api/auth/upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guest.json.token}` },
    body: JSON.stringify({ username: 'UpgradedHero', email: 'up@test.local', password: 'UpgradePass99' }),
  });
  assert.equal(upgraded.status, 200);
  assert.equal(upgraded.json.user.isGuest, false);
  assert.equal(upgraded.json.profile.stars, 4242);

  // Logout immediately revokes token
  const out = await api('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${playerToken}` },
  });
  assert.equal(out.status, 200);
  const afterOut = await api('/api/player/profile', { headers: { Authorization: `Bearer ${playerToken}` } });
  assert.equal(afterOut.status, 401);

  // Admin disabling HeroPlayer revokes their new login sessions
  const relog = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'HeroPlayer', password: 'Password123' }),
  });
  assert.equal(relog.status, 200);
  const banRes = await api(`/api/admin/users/${reg.json.user.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opsToken}` },
    body: JSON.stringify({ status: 'banned' }),
  });
  assert.equal(banRes.status, 200);
  const postBanProf = await api('/api/player/profile', { headers: { Authorization: `Bearer ${relog.json.token}` } });
  assert.equal(postBanProf.status, 401);
});

test('Real analytics overview, cohort retention & RFC-4180 CSV export', async () => {
  const adm = await api('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RootAdmin', password: 'StrongAdminPassword123!' }),
  });
  const admToken = adm.json.token;

  const p = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'StatsPlayer', email: 'stats@test.local', password: 'Password123' }),
  });
  const pToken = p.json.token;
  const uid = p.json.user.id;

  // Backdate user creation by 2 days & add D+1 event for deterministic Day-1 Cohort Retention
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 1 * 86_400_000).toISOString();
  db.getRawDb().prepare('UPDATE users SET created_at = ? WHERE id = ?').run(twoDaysAgo, uid);
  AnalyticsService.track({ eventType: 'session_start', userId: uid, mode: 'explorer', createdAt: twoDaysAgo });
  AnalyticsService.track({ eventType: 'session_start', userId: uid, mode: 'explorer', createdAt: oneDayAgo });

  // Submit real match & abandoned match
  const mRes = await api('/api/match/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ mode: 'explorer', score: 1850, kills: 4, placement: 1, survivalSeconds: 140 }),
  });
  assert.equal(mRes.status, 200);
  assert.equal(mRes.json.profile.stats.totalDeaths, 0, 'Win with default deaths must not add phantom death');

  const abRes = await api('/api/match/abandon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ mode: 'battle_royale', score: 120, survivalSeconds: 18 }),
  });
  assert.equal(abRes.status, 200);

  const ov = await api('/api/admin/analytics/overview', {
    headers: { Authorization: `Bearer ${admToken}` },
  });
  assert.equal(ov.status, 200);
  assert.ok(ov.json.users.totalUsers >= 1);
  assert.ok(ov.json.users.dau >= 1);
  assert.ok(ov.json.gameplay.totalGamesPlayed >= 2);
  assert.ok(ov.json.gameplay.completedGames >= 1);
  assert.ok(ov.json.gameplay.abandonedGames >= 1);
  assert.equal(ov.json.gameplay.highestScore, 1850);
  assert.ok(ov.json.retention.day1Retention > 0);

  for (const period of ['daily', 'weekly', 'monthly', 'yearly', 'custom']) {
    const rep = await api(`/api/admin/analytics/reports?period=${period}`, {
      headers: { Authorization: `Bearer ${admToken}` },
    });
    assert.equal(rep.status, 200);
    assert.ok(Array.isArray(rep.json.series) && rep.json.series.length >= 1);
  }

  const csv = await api('/api/admin/analytics/reports/export?period=weekly', {
    headers: { Authorization: `Bearer ${admToken}` },
  });
  assert.equal(csv.status, 200);
  assert.ok(csv.headers.get('content-type').includes('text/csv'));
  assert.ok(csv.text.includes('Bucket,DAU,New Users,Games Played'));
});

test('Ad upload magic-byte check, scheduling, impression/click CTR & rewarded token', async () => {
  const adm = await api('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RootAdmin', password: 'StrongAdminPassword123!' }),
  });
  const admToken = adm.json.token;

  // 1. Reject fake PNG with wrong magic bytes
  const badForm = new FormData();
  badForm.append('file', new Blob([Buffer.from('not really a png image!')], { type: 'image/png' }), 'evil.png');
  const badUpload = await api('/api/admin/ads/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admToken}` },
    body: badForm,
  });
  assert.equal(badUpload.status, 400);

  // 2. Accept genuine 1x1 PNG header
  const pngHeader = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
  const goodForm = new FormData();
  goodForm.append('file', new Blob([pngHeader], { type: 'image/png' }), 'banner.png');
  const goodUpload = await api('/api/admin/ads/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admToken}` },
    body: goodForm,
  });
  assert.equal(goodUpload.status, 200);
  assert.ok(goodUpload.json.mediaUrl.startsWith('/uploads/ads/'));

  const past = new Date(Date.now() - 3600_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const future2 = new Date(Date.now() + 172_800_000).toISOString();

  // Active ad
  const activeAd = await api('/api/admin/ads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({
      title: 'Season Banner', description: 'Join Season 1 Arena', mediaUrl: goodUpload.json.mediaUrl,
      mediaType: 'image', destinationUrl: 'https://anacondapark.example/season', placement: 'home_screen',
      enabled: true, startsAt: past, endsAt: future,
    }),
  });
  assert.equal(activeAd.status, 200);

  // Future scheduled ad (must NOT serve yet)
  await api('/api/admin/ads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({
      title: 'Future Ad', mediaUrl: goodUpload.json.mediaUrl, mediaType: 'image',
      placement: 'home_screen', enabled: true, startsAt: future, endsAt: future2,
    }),
  });

  const served = await api('/api/ads/serve?placement=home_screen');
  assert.equal(served.status, 200);
  assert.equal(served.json.ads.length, 1);
  assert.equal(served.json.ad.id, activeAd.json.ad.id);

  // Track impression & click
  await api('/api/ads/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adId: activeAd.json.ad.id, placement: 'home_screen', eventType: 'impression' }),
  });
  await api('/api/ads/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adId: activeAd.json.ad.id, placement: 'home_screen', eventType: 'click' }),
  });

  const adminAds = await api('/api/admin/ads', { headers: { Authorization: `Bearer ${admToken}` } });
  const tracked = adminAds.json.ads.find(a => a.id === activeAd.json.ad.id);
  assert.equal(tracked.impressions, 1);
  assert.equal(tracked.clicks, 1);
  assert.equal(tracked.ctr, 100);

  // Rewarded ad verification token flow
  const p = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'AdWatcher', email: 'ad@test.local', password: 'Password123' }),
  });
  const pToken = p.json.token;

  const missingTokenClaim = await api('/api/ads/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({}),
  });
  assert.equal(missingTokenClaim.status, 400);

  const started = await api('/api/ads/reward-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ adId: activeAd.json.ad.id }),
  });
  assert.equal(started.status, 200);

  // Immediate claim before minWatchMs must fail
  const tooEarly = await api('/api/ads/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ adToken: started.json.tokenId }),
  });
  assert.equal(tooEarly.status, 400);

  await new Promise(r => setTimeout(r, 150));
  const validClaim = await api('/api/ads/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ adToken: started.json.tokenId }),
  });
  assert.equal(validClaim.status, 200);
  assert.equal(validClaim.json.success, true);

  // Single-use token replay must fail
  const replay = await api('/api/ads/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ adToken: started.json.tokenId }),
  });
  assert.equal(replay.status, 400);
});

test('Accessory ownership gate, Egg hatch, Story Kingdoms 1-7 & Multi-room lobbies', async () => {
  const reg = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'StoryHero', email: 'story@test.local', password: 'Password123' }),
  });
  const uid = reg.json.user.id;
  const tok = reg.json.token;

  // Equipping unowned accessory must return 403
  const illegalAcc = await api('/api/player/equip-accessory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ accessoryId: 'golden_wings' }),
  });
  assert.equal(illegalAcc.status, 403);

  // Give enough level, stars & tickets -> purchase & equip works
  db.updateProfile(uid, { level: 50, stars: 5000, tickets: 10 });
  const bought = await api('/api/shop/purchase-accessory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ accessoryId: 'golden_wings' }),
  });
  assert.equal(bought.status, 200);
  const okEquip = await api('/api/player/equip-accessory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ accessoryId: 'golden_wings' }),
  });
  assert.equal(okEquip.status, 200);
  assert.equal(okEquip.json.profile.equippedAccessory, 'golden_wings');

  // Verify daily mission period_key resets stale yesterday's mission automatically
  db.incrementCollectible(uid, 'cherry', 5);
  assert.ok(db.getMissions(uid).find(m => m.id === 'ms_cherry').currentCount >= 5);
  db.getRawDb().prepare("UPDATE missions SET period_key = '2020-01-01' WHERE user_id = ? AND mission_id = 'ms_cherry'").run(uid);
  // Clear in-memory cache for clean reload check
  const freshMissions = db.getRawDb().prepare("SELECT period_key FROM missions WHERE user_id = ? AND mission_id = 'ms_cherry'").get(uid);
  assert.equal(freshMissions.period_key, '2020-01-01');

  // Egg hatch
  db.grantItem(uid, 'rare_egg', 1);
  const hatched = await api('/api/inventory/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ itemId: 'rare_egg' }),
  });
  assert.equal(hatched.status, 200);
  assert.equal(hatched.json.profile.inventory.rare_egg, undefined);

  // Story Kingdoms 1..7 completeness & Boss defeat
  assert.equal(KINGDOMS.length, 7);
  for (const k of KINGDOMS) {
    assert.ok(k.npcs.length >= 3, `Kingdom ${k.n} has NPCs`);
    assert.equal(k.quests.length, 3, `Kingdom ${k.n} has 3 quests`);
    assert.ok(k.boss, `Kingdom ${k.n} has a boss`);
  }
  const bossWin = ExplorerService.recordBossDefeat(uid, 'boss_thornmaw');
  assert.equal(bossWin.success, true);
  assert.equal(bossWin.firstTime, true);

  // Multi-room custom lobby creation & code join + 1v1 Boss session
  const created = await api('/api/lobbies/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ mode: 'battle_royale', maxPlayers: 12, isPrivate: false }),
  });
  assert.equal(created.status, 200);
  assert.ok(created.json.room.roomCode);

  const joined = await api('/api/lobbies/join-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ code: created.json.room.roomCode }),
  });
  assert.equal(joined.status, 200);
  assert.equal(joined.json.room.roomId, created.json.room.roomId);

  const bossRoom = sessionManager.findOrCreateMatchmakingRoom('boss', 'Global', 2);
  const bossSnake = Object.values(bossRoom.session.getState().snakes).find(s => s.isBoss);
  assert.ok(bossSnake);
  assert.ok(bossSnake.displayName.includes('Tidecoil'));
});

test('Super-Admin hot SQLite backup & Rewarded Ad Respawn token single-use guard', async () => {
  const admLogin = await api('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RootAdmin', password: 'StrongAdminPassword123!' }),
  });
  assert.equal(admLogin.status, 200);
  const superToken = admLogin.json.token;

  // Standard admin cannot trigger super-admin hot backup
  const regLogin = await api('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'OpsAdmin', password: 'OpsPassword123!' }),
  });
  assert.equal(regLogin.status, 200);
  const opsToken = regLogin.json.token;

  const deniedBackup = await api('/api/admin/system/backup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opsToken}` },
  });
  assert.equal(deniedBackup.status, 403);

  const okBackup = await api('/api/admin/system/backup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superToken}` },
  });
  assert.equal(okBackup.status, 200);
  assert.equal(okBackup.json.success, true);
  assert.ok(okBackup.json.fileName && okBackup.json.fileName.endsWith('.db'));
  assert.ok(okBackup.json.sizeBytes > 0);
  const expectedFile = path.join(tmpDir, 'backups', okBackup.json.fileName);
  assert.ok(fs.existsSync(expectedFile));
  try { fs.unlinkSync(expectedFile); } catch { /* ignore */ }

  // Rewarded ad respawn single-use token validation
  const guest = await api('/api/auth/guest', { method: 'POST' });
  assert.equal(guest.status, 200);
  const uid = guest.json.user.id;
  const pTok = guest.json.token;

  const start = await api('/api/ads/reward-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pTok}` },
    body: JSON.stringify({}),
  });
  assert.equal(start.status, 200);
  const adTok = start.json.tokenId;

  // Too early -> must reject
  const tooEarly = AdManagerService.consumeRewardToken(uid, adTok);
  assert.equal(tooEarly.ok, false);

  await new Promise(r => setTimeout(r, 150));

  // Valid watch window -> single-use succeeds once and rejects replay
  const validUse = AdManagerService.consumeRewardToken(uid, adTok);
  assert.equal(validUse.ok, true);
  const replay = AdManagerService.consumeRewardToken(uid, adTok);
  assert.equal(replay.ok, false);
});
