// Phase 14 Comprehensive QA — Adventure RPG, NPC Proximity, Quest Engine,
// 1,000-Level Campaign, Boss Milestones, Quiz Engine, Team Objectives, Private Rooms, Admin CMS & RPG Analytics.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap_rpg_test_'));
process.env.DATA_FILE = path.join(tmpDir, 'rpg_test.json');
process.env.AD_UPLOAD_DIR = path.join(tmpDir, 'uploads');
process.env.ADMIN_BOOTSTRAP_USERNAME = 'RpgAdmin';
process.env.ADMIN_BOOTSTRAP_PASSWORD = 'StrongRpgAdminPassword123!';
process.env.ADMIN_BOOTSTRAP_EMAIL = 'rpgadmin@anacondapark.test';

const { app } = require('../dist/server');
const { db } = require('../dist/db/Database');
const { KINGDOMS, ALL_WORLDS } = require('../dist/config/ExplorerContent');
const { GameSessionService } = require('../dist/services/GameSessionService');
const { sessionManager } = require('../dist/services/GameSessionManager');
const { NPCInteractionService } = require('../dist/services/NPCInteractionService');
const { QuestEngineService } = require('../dist/services/QuestEngineService');
const { AdventureProgressionService, CAMPAIGN_WORLDS } = require('../dist/services/AdventureProgressionService');
const { BossProgressionService } = require('../dist/services/BossProgressionService');
const { QuestionBankService } = require('../dist/services/QuestionBankService');
const { TeamObjectiveService } = require('../dist/services/TeamObjectiveService');

let httpServer;
let baseUrl = '';

async function api(route, opts = {}) {
  const res = await fetch(`${baseUrl}${route}`, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* plain text */ }
  return { status: res.status, headers: res.headers, text, json };
}

async function createPlayer(username) {
  const r = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username.toLowerCase()}@test.local`,
      password: 'Password123!',
    }),
  });
  assert.equal(r.status, 200, `register ${username}: ${r.text}`);
  return { token: r.json.token, user: r.json.user };
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

// ============================================================================
// 1. NPC INTERACTION ENGINE: SWEPT MOTION, TOROIDAL WRAP, HYSTERESIS & PVP GUARD
// ============================================================================
test('NPC Proximity: swept motion, toroidal edge wrap, hysteresis & re-arming', async () => {
  const p = await createPlayer('ProxTester1');
  const pWrap = await createPlayer('ProxTester2');
  const npcSvc = new NPCInteractionService({ enterMargin: 82, exitHysteresis: 64, retriggerCooldownMs: 50 });
  const npcs = [
    { id: 'npc_elder_moss', name: 'Elder Moss', role: 'elder', x: 1000, y: 1000, radius: 42, greeting: 'Hi', icon: '🐍', accessory: '🧙' },
    { id: 'npc_guard_bram', name: 'Guard Bram', role: 'guard', x: 5, y: 500, radius: 42, greeting: 'Wrap!', icon: '🐍', accessory: '🛡️' },
  ];

  // Seed starting position at (800, 1000), then sweep at high speed across (1000,1000) to (1200,1000)
  npcSvc.evaluateStep(p.user.id, 800, 1000, 16, npcs, 6000, 900);
  const hit1 = npcSvc.evaluateStep(p.user.id, 1200, 1000, 16, npcs, 6000, 1000);
  assert.equal(hit1.entered?.npcId, 'npc_elder_moss', 'swept fast movement must detect NPC even if endpoints are outside');

  // Staying inside does NOT re-trigger
  const stay = npcSvc.evaluateStep(p.user.id, 1010, 1000, 16, npcs, 6000, 1020);
  assert.equal(stay.entered, undefined, 'staying inside must not spam re-triggers');

  // Moving slightly outside enterR (42+16+82=140) but still within hysteresis (140+64=204) does NOT re-arm
  npcSvc.evaluateStep(p.user.id, 1170, 1000, 16, npcs, 6000, 1100);
  const noRetrigger = npcSvc.evaluateStep(p.user.id, 1020, 1000, 16, npcs, 6000, 1200);
  assert.equal(noRetrigger.entered, undefined, 'must remain armed only after exiting hysteresis ring');

  // Exiting past 204px (to x=1300) and re-entering after cooldown DOES re-trigger
  npcSvc.evaluateStep(p.user.id, 1300, 1000, 16, npcs, 6000, 1300);
  const reEntered = npcSvc.evaluateStep(p.user.id, 1010, 1000, 16, npcs, 6000, 1400);
  assert.equal(reEntered.entered?.npcId, 'npc_elder_moss', 're-entering after full exit + cooldown triggers cleanly');

  // Toroidal edge wrap: start outside enterR at x=5800 (205px wrapped from x=5), then sweep across seam to x=200!
  const beforeWrap = npcSvc.evaluateStep(pWrap.user.id, 5800, 500, 16, npcs, 6000, 1900);
  assert.equal(beforeWrap.entered, undefined, 'x=5800 is outside enterR=140 of x=5');
  const wrapHit = npcSvc.evaluateStep(pWrap.user.id, 200, 500, 16, npcs, 6000, 2000);
  assert.equal(wrapHit.entered?.npcId, 'npc_guard_bram', 'toroidal edge wrap must detect NPC across world seam');
});

test('Safe NPC interaction freeze works in classic adventure ONLY and is blocked in PvP modes', () => {
  const classic = new GameSessionService('npc_freeze_classic', 'classic', { kingdom: 1 });
  classic.stop();
  const s1 = classic.registerPlayer('p1', 'ExplorerOne');
  assert.equal(classic.setPlayerInteraction('p1', true), true);
  assert.equal(s1.inInteraction, true);
  assert.equal(classic.setPlayerInteraction('p1', false), true);
  assert.equal(s1.inInteraction, false);

  // Competitive modes MUST reject pause-immunity & interaction freeze exploits
  for (const pvpMode of ['battle_royale', 'team', 'boss', 'event']) {
    const sess = new GameSessionService(`pvp_${pvpMode}`, pvpMode);
    sess.stop();
    const p = sess.registerPlayer('p_pvp', 'Challenger');
    assert.equal(sess.setPlayerInactive('p_pvp', true), false, `${pvpMode} must reject setPlayerInactive(true)`);
    assert.equal(sess.setPlayerInteraction('p_pvp', true), false, `${pvpMode} must reject setPlayerInteraction(true)`);
    assert.equal(Boolean(p.isPaused), false, `${pvpMode} player must never gain pause immunity`);
    assert.equal(Boolean(p.inInteraction), false, `${pvpMode} player must never gain interaction freeze`);
  }
});

// ============================================================================
// 2. QUEST ENGINE STATE MACHINE: LATER / SKIP / ACCEPT / 1-LIMIT / CLAIM IDEMPOTENCY
// ============================================================================
test('Quest Engine: NPC interact, Later, Skip (0 reward), Accept, 1-quest limit, multi-stage & idempotent claim', async () => {
  const p = await createPlayer('QuestHero1');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${p.token}` };

  // 1) Interact with Elder Moss (npc_elder_moss) -> returns Level 1 offer
  const inter = await api('/api/adventure/npc/interact', {
    method: 'POST', headers, body: JSON.stringify({ npcId: 'npc_elder_moss' }),
  });
  assert.equal(inter.status, 200);
  assert.equal(inter.json.ok, true);
  assert.equal(inter.json.encounter.npcId, 'npc_elder_moss');
  assert.equal(inter.json.encounter.levelNumber, 1);
  assert.ok(inter.json.encounter.rewards.stars > 0);
  const qId = inter.json.encounter.questId;

  // 2) Later keeps quest available (no active quest)
  const later = await api('/api/adventure/quest/later', {
    method: 'POST', headers, body: JSON.stringify({ questId: qId, npcId: 'npc_elder_moss' }),
  });
  assert.equal(later.status, 200);
  assert.equal(QuestEngineService.getActiveMainQuest(p.user.id), null);

  // 3) Skip grants 0 rewards and does not activate
  const starsBeforeSkip = db.getProfile(p.user.id).stars;
  const skip = await api('/api/adventure/quest/skip', {
    method: 'POST', headers, body: JSON.stringify({ questId: qId, npcId: 'npc_elder_moss' }),
  });
  assert.equal(skip.status, 200);
  assert.equal(db.getProfile(p.user.id).stars, starsBeforeSkip, 'Skip must award 0 stars');
  assert.equal(QuestEngineService.getActiveMainQuest(p.user.id), null);

  // 4) Accept Level 1 Quest -> active
  const acc1 = await api('/api/adventure/quest/accept', {
    method: 'POST', headers, body: JSON.stringify({ levelNumber: 1, npcId: 'npc_elder_moss' }),
  });
  assert.equal(acc1.status, 200);
  assert.equal(acc1.json.ok, true);
  assert.equal(acc1.json.session.state, 'ACTIVE');

  // 5) Idempotent double-tap on same quest returns same session, while accepting a DIFFERENT main quest is blocked (1-quest limit)
  const accSame = await api('/api/adventure/quest/accept', {
    method: 'POST', headers, body: JSON.stringify({ levelNumber: 1 }),
  });
  assert.equal(accSame.status, 200);
  assert.equal(accSame.json.session.sessionId, acc1.json.session.sessionId, 'Double-tap accept is idempotent');

  const accOther = await api('/api/adventure/quest/accept', {
    method: 'POST', headers, body: JSON.stringify({ questId: 'q1_forage' }),
  });
  assert.equal(accOther.status, 400);
  assert.match(accOther.json.error, /before accepting another main quest/i);

  // 6) Advance Level 1 objective (collect 5 foods) -> transitions ACTIVE -> CLAIMABLE
  const activeId = acc1.json.session.sessionId;
  let lastUpd = null;
  for (let i = 0; i < 5; i++) {
    lastUpd = QuestEngineService.recordGameplayMetric(p.user.id, 'any_food', 1);
  }
  assert.ok(lastUpd?.completed, 'Level 1 should reach CLAIMABLE after 5 foods');
  assert.equal(lastUpd.session.state, 'CLAIMABLE');

  // Reconnect check: active main quest persists in SQLite
  const restored = QuestEngineService.getActiveMainQuest(p.user.id);
  assert.equal(restored.sessionId, activeId);
  assert.equal(restored.state, 'CLAIMABLE');

  // 7) Claim reward atomically + verify Level 2 unlocked
  const starsBeforeClaim = db.getProfile(p.user.id).stars;
  const claim1 = await api('/api/adventure/quest/claim', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: activeId }),
  });
  assert.equal(claim1.status, 200);
  assert.equal(claim1.json.ok, true);
  assert.equal(Boolean(claim1.json.alreadyClaimed), false);
  const starsAfterClaim = db.getProfile(p.user.id).stars;
  assert.ok(starsAfterClaim > starsBeforeClaim, 'Claim must grant stars');
  assert.equal(claim1.json.overview.axes.highestUnlockedLevel, 2, 'Completing Lv.1 must unlock Lv.2');

  // 8) Duplicate claim is idempotent and awards 0 extra stars
  const claim2 = await api('/api/adventure/quest/claim', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: activeId }),
  });
  assert.equal(claim2.status, 200);
  assert.equal(claim2.json.alreadyClaimed, true);
  assert.equal(db.getProfile(p.user.id).stars, starsAfterClaim, 'Duplicate claim must not double-grant rewards');
});

// ============================================================================
// 3. EDUCATIONAL QUIZ ENGINE: ZERO LEAKAGE, GRADING, ADAPTIVE DIFFICULTY, RECONNECT
// ============================================================================
test('Educational Quiz Engine: curated bank, zero answer leakage, validation, grading & reconnect', async () => {
  QuestionBankService.ensureSeeded();
  const allQs = QuestionBankService.listQuestions({ status: 'published', limit: 200 });
  assert.ok(allQs.length >= 40, `Expected >=40 seeded questions, got ${allQs.length}`);
  for (const cat of ['word', 'math', 'memory', 'logic']) {
    assert.ok(allQs.some(q => q.category === cat), `Category ${cat} must be populated`);
  }

  const p = await createPlayer('QuizScholar');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${p.token}` };

  // Unlock Level 3 (Word Puzzle) & Level 4 (Math) cleanly via progression service
  AdventureProgressionService.recordLevelCompletion(p.user.id, 1);
  AdventureProgressionService.recordLevelCompletion(p.user.id, 2);

  // Accept Level 3 (3 Word Challenges) -> spawns quiz session immediately
  const acc = await api('/api/adventure/quest/accept', {
    method: 'POST', headers, body: JSON.stringify({ levelNumber: 3 }),
  });
  assert.equal(acc.status, 200);
  assert.ok(acc.json.quizQuestion, 'Quiz level accept must return first question');
  const firstQ = acc.json.quizQuestion;

  // STRICT SECURITY CHECK: Client payload MUST NEVER leak correctAnswer or explanation!
  assert.equal('correctAnswer' in firstQ, false, 'correctAnswer must NEVER leak to client');
  assert.equal('explanation' in firstQ, false, 'explanation must NEVER leak before submission');

  // Reconnect restore via GET /api/adventure/quiz/:id
  const rec = await api(`/api/adventure/quiz/${firstQ.quizSessionId}`, { headers });
  assert.equal(rec.status, 200);
  assert.equal(rec.json.currentQuestion.questionId, firstQ.questionId);
  assert.equal('correctAnswer' in rec.json.currentQuestion, false);

  // Reject invalid option not in choices
  const badOpt = await api('/api/adventure/quiz/answer', {
    method: 'POST', headers,
    body: JSON.stringify({ quizSessionId: firstQ.quizSessionId, questionId: firstQ.questionId, answer: '__INJECTED_CHEAT__', responseMs: 1200 }),
  });
  assert.equal(badOpt.status, 400);

  // Answer all 3 questions accurately by looking up authoritative DB row (server-side test oracle only)
  let qCursor = firstQ;
  let lastSubmit = null;
  const seenIds = new Set();
  for (let step = 0; step < 3; step++) {
    assert.equal(seenIds.has(qCursor.questionId), false, 'Quiz session must never repeat a question');
    seenIds.add(qCursor.questionId);
    const dbRow = db.getRawDb().prepare('SELECT correct_answer FROM question_bank WHERE question_id = ?').get(qCursor.questionId);
    assert.ok(dbRow, 'Question exists in SQLite bank');

    const sub = await api('/api/adventure/quiz/answer', {
      method: 'POST', headers,
      body: JSON.stringify({
        quizSessionId: qCursor.quizSessionId,
        questionId: qCursor.questionId,
        answer: dbRow.correct_answer,
        responseMs: 1800,
      }),
    });
    assert.equal(sub.status, 200);
    assert.equal(sub.json.isCorrect, true);
    assert.ok(sub.json.explanation.length > 5, 'Server must return educational explanation after grading');
    lastSubmit = sub.json;
    qCursor = sub.json.nextQuestion;
  }

  assert.equal(lastSubmit.completed, true);
  assert.equal(lastSubmit.passed, true);
  assert.equal(lastSubmit.questUpdate?.session?.state, 'CLAIMABLE');

  // Claim Level 3 -> unlocks Level 4!
  const claim = await api('/api/adventure/quest/claim', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: acc.json.session.sessionId }),
  });
  assert.equal(claim.status, 200);
  assert.equal(claim.json.overview.axes.highestUnlockedLevel, 4);

  // Adaptive difficulty check: high recent accuracy pushes difficulty upward
  const adapted = QuestionBankService.computeAdaptiveDifficulty(p.user.id, 1);
  assert.ok(adapted >= 2, `Expected adaptive difficulty >= 2 after 100% streak, got ${adapted}`);
});

// ============================================================================
// 4. 1,000-LEVEL CAMPAIGN, BOSS CHECKPOINTS (EVERY 10) & MILESTONES (EVERY 100 + LV.1000)
// ============================================================================
test('1,000-Level Campaign: 10 worlds, 7 legacy kingdoms preserved, Lv.10/20/100/1000 milestones & replay throttle', async () => {
  // Backward compatibility invariant
  assert.equal(KINGDOMS.length, 7, 'Legacy KINGDOMS array must remain length 7');
  assert.equal(ALL_WORLDS.length, 10, 'ALL_WORLDS must contain all 10 campaign worlds');
  assert.equal(CAMPAIGN_WORLDS.length, 10);

  // Verify every 10th level is a boss checkpoint and every 100th is a 3-stage major milestone
  let bossCount = 0;
  let milestoneCount = 0;
  for (let lvl = 1; lvl <= 1000; lvl++) {
    const def = AdventureProgressionService.getLevelDef(lvl);
    if (lvl % 10 === 0) {
      assert.equal(def.isBossCheckpoint, true, `Level ${lvl} must be boss checkpoint`);
      assert.ok(def.stages.length >= 2, `Boss checkpoint ${lvl} must have >= 2 stages`);
      bossCount++;
    }
    if (lvl % 100 === 0) {
      assert.equal(def.isMajorMilestone, true, `Level ${lvl} must be major milestone`);
      assert.equal(def.stages.length, 3, `Major milestone ${lvl} must have 3 stages`);
      milestoneCount++;
    }
  }
  assert.equal(bossCount, 100, 'Must have 100 boss checkpoints');
  assert.equal(milestoneCount, 10, 'Must have 10 major milestones');

  const p = await createPlayer('CampaignChampion');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${p.token}` };

  // Locked level 10 cannot be accepted before unlocking
  const lockedTry = await api('/api/adventure/quest/accept', {
    method: 'POST', headers, body: JSON.stringify({ levelNumber: 10 }),
  });
  assert.equal(lockedTry.status, 400);
  assert.match(lockedTry.json.error, /locked/i);

  // Progress through Levels 1..9 -> Level 10 Boss Checkpoint (2 stages: collect 5 + 2 sanctum switches)
  for (let l = 1; l <= 9; l++) AdventureProgressionService.recordLevelCompletion(p.user.id, l);
  const acc10 = await api('/api/adventure/quest/accept', {
    method: 'POST', headers, body: JSON.stringify({ levelNumber: 10 }),
  });
  assert.equal(acc10.status, 200);
  assert.equal(acc10.json.session.stageTotal, 2);

  // Stage 1: collect 5 foods -> advances to Stage 2 (switches)
  for (let i = 0; i < 5; i++) QuestEngineService.recordGameplayMetric(p.user.id, 'any_food', 1);
  const mid10 = QuestEngineService.getActiveMainQuest(p.user.id);
  assert.equal(mid10.stageIndex, 1, 'Boss Lv.10 should advance to Stage 2 switches');
  assert.equal(mid10.currentStage.kind, 'switches');

  // Stage 2: visit both sanctum switch coordinates via spatial tick -> CLAIMABLE
  for (const sw of mid10.currentStage.switches) {
    QuestEngineService.recordSpatialTick(p.user.id, sw.x, sw.y, 0.5);
  }
  const done10 = QuestEngineService.getActiveMainQuest(p.user.id);
  assert.equal(done10.state, 'CLAIMABLE');
  const claim10 = await api('/api/adventure/quest/claim', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: acc10.json.session.sessionId }),
  });
  assert.equal(claim10.status, 200);
  assert.equal(claim10.json.overview.axes.bossCheckpointsCleared, 1);

  // Replay throttling check: replaying Lv.10 grants reduced stars (30%) and 0 extra tickets
  const replay10 = AdventureProgressionService.recordLevelCompletion(p.user.id, 10);
  assert.equal(replay10.firstClear, false);
  assert.equal(replay10.rewardsGranted.tickets, 0);

  // Test Level 5 Navigation Waypoints in sequence
  const acc5 = await api('/api/adventure/quest/accept', {
    method: 'POST', headers, body: JSON.stringify({ levelNumber: 5 }),
  });
  assert.equal(acc5.status, 200);
  const wps = acc5.json.session.currentStage.waypoints;
  assert.equal(wps.length, 3);
  // Visiting waypoint #2 out of order should NOT advance progress
  QuestEngineService.recordSpatialTick(p.user.id, wps[1].x, wps[1].y, 0.2);
  assert.equal(QuestEngineService.getActiveMainQuest(p.user.id).progress, 0);
  // Visiting in exact order 0 -> 1 -> 2 completes quest
  for (const wp of wps) QuestEngineService.recordSpatialTick(p.user.id, wp.x, wp.y, 0.2);
  assert.equal(QuestEngineService.getActiveMainQuest(p.user.id).state, 'CLAIMABLE');
  await api('/api/adventure/quest/claim', {
    method: 'POST', headers, body: JSON.stringify({ sessionId: acc5.json.session.sessionId }),
  });

  // Level 100 & Level 1,000 Major Milestone + Sovereign Eclipse Finale unlocks
  const res100 = AdventureProgressionService.recordLevelCompletion(p.user.id, 100);
  assert.equal(res100.milestoneUnlocked, 100);
  const res1000 = AdventureProgressionService.recordLevelCompletion(p.user.id, 1000);
  assert.equal(res1000.milestoneUnlocked, 1000);
  assert.match(res1000.legendaryUnlocked, /Sovereign Eclipse/i);

  const prof1000 = db.getProfile(p.user.id);
  assert.ok(prof1000.unlockedSkins.includes('Mythical'), 'Lv.1000 unlocks Mythical skin');
  assert.ok(prof1000.unlockedAccessories.includes('golden_wings'), 'Lv.1000 unlocks Golden Wings');
  assert.equal(prof1000.title, 'Sovereign of Coils');
  assert.ok(BossProgressionService.listClearedBosses(p.user.id).length >= 1);
});

// ============================================================================
// 5. MULTIPLAYER TEAM BATTLE ROYALE OBJECTIVES & PRIVATE ROOM LOBBY STAGING
// ============================================================================
test('Team Battle Royale: control zones, relic pickup/delivery, objective scoring & zero friendly fire', () => {
  const sess = new GameSessionService('team_obj_test', 'team');
  sess.stop();
  const st = sess.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]); // deterministic isolated snakes
  assert.equal(st.teamZones.length, 3, 'Must spawn 3 control zones');
  assert.equal(st.teamRelics.length, 2, 'Must spawn 2 relics');
  assert.ok(st.teamBases?.blue && st.teamBases?.red, 'Must spawn Red & Blue bases');

  const b1 = sess.registerPlayer('blue_1', 'BlueOne'); b1.team = 'blue';
  const b2 = sess.registerPlayer('blue_2', 'BlueTwo'); b2.team = 'blue';
  b1.score = 1200; b2.score = 200;

  // Friendly fire check: overlapping heads on same team NEVER eliminate each other
  b1.head = { x: 2000, y: 2000 }; b1.body = Array.from({ length: 9 }, (_, i) => ({ x: 2000 - i * 14, y: 2000 }));
  b2.head = { x: 2000, y: 2000 }; b2.body = Array.from({ length: 9 }, (_, i) => ({ x: 2000 - i * 14, y: 2000 }));
  sess.stepForTest();
  assert.equal(b1.isAlive, true, 'Friendly fire forbidden');
  assert.equal(b2.isAlive, true, 'Friendly fire forbidden');

  // Control Zone capture: park Blue snake inside Crown Plaza (3000, 3000) and tick for 5 seconds
  const zone = st.teamZones[1];
  b1.head = { x: zone.x, y: zone.y };
  b2.head = { x: 400, y: 400 };
  for (let i = 0; i < 6; i++) {
    st.tick = i * 30;
    TeamObjectiveService.tick(st, 1.0, st.worldSize);
  }
  assert.equal(zone.owner, 'blue', 'Holding uncontested zone captures it for Blue');
  assert.ok(st.teamScores.blue > 0, 'Captured zone awards team points');
  assert.ok((b1.teamContribution || 0) > 0, 'Individual player receives teamContribution credit');

  // Relic pickup & delivery to Blue base -> +15 points!
  const relic = st.teamRelics[0];
  b1.head = { x: relic.x, y: relic.y };
  TeamObjectiveService.tick(st, 0.1, st.worldSize);
  assert.equal(relic.carrierId, b1.id, 'Snake picks up neutral relic');
  assert.equal(b1.carryingRelicId, relic.id);

  const blueBase = st.teamBases.blue;
  const scoreBeforeDeliver = st.teamScores.blue;
  b1.head = { x: blueBase.x, y: blueBase.y };
  TeamObjectiveService.tick(st, 0.1, st.worldSize);
  assert.ok(st.teamScores.blue >= scoreBeforeDeliver + 15, 'Delivering relic to home base grants +15 team pts');
  assert.equal(relic.carrierId, undefined, 'Relic resets after delivery');
});

test('Private Room Staging: create, auth guard, invite, duplicate join idempotency, ready & host start', async () => {
  const host = await createPlayer('RoomHost');
  const guest = await createPlayer('InvitedFriend');
  const intruder = await createPlayer('RandomIntruder');

  const hHdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${host.token}` };
  const gHdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${guest.token}` };
  const iHdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${intruder.token}` };

  // Create staged private room
  const cr = await api('/api/lobbies/create', {
    method: 'POST', headers: hHdr,
    body: JSON.stringify({
      mode: 'team', maxPlayers: 8, isPrivate: true, withBots: true,
      mapTheme: 'volcano', durationSeconds: 240, stageInLobby: true,
    }),
  });
  assert.equal(cr.status, 200);
  const room = cr.json.room;
  assert.equal(room.stageStatus, 'lobby');
  assert.equal(room.isPrivate, true);
  assert.equal(room.mapTheme, 'volcano');
  assert.equal(room.durationSeconds, 240);

  // Intruder without code or invite is rejected (403)
  const denied = await api(`/api/lobbies/${room.roomId}/join`, {
    method: 'POST', headers: iHdr, body: JSON.stringify({}),
  });
  assert.equal(denied.status, 403);

  // Host invites friend -> friend can join without typing code
  const inv = await api(`/api/lobbies/${room.roomId}/invite`, {
    method: 'POST', headers: hHdr, body: JSON.stringify({ targetUserId: guest.user.id }),
  });
  assert.equal(inv.status, 200);

  const gJoin1 = await api(`/api/lobbies/${room.roomId}/join`, {
    method: 'POST', headers: gHdr, body: JSON.stringify({}),
  });
  assert.equal(gJoin1.status, 200);
  assert.equal(gJoin1.json.room.members.length, 2);

  // Duplicate join is idempotent (still 2 members)
  const gJoin2 = await api(`/api/lobbies/${room.roomId}/join`, {
    method: 'POST', headers: gHdr, body: JSON.stringify({}),
  });
  assert.equal(gJoin2.status, 200);
  assert.equal(gJoin2.json.room.members.length, 2);

  // Guest marks ready
  const rdy = await api(`/api/lobbies/${room.roomId}/ready`, {
    method: 'POST', headers: gHdr, body: JSON.stringify({ ready: true }),
  });
  assert.equal(rdy.status, 200);
  assert.equal(rdy.json.room.members.find(m => m.userId === guest.user.id).ready, true);

  // Non-host cannot start match (403)
  const nonHostStart = await api(`/api/lobbies/${room.roomId}/start`, {
    method: 'POST', headers: gHdr, body: JSON.stringify({}),
  });
  assert.equal(nonHostStart.status, 403);

  // Host starts match -> transitions to 'open'
  const hostStart = await api(`/api/lobbies/${room.roomId}/start`, {
    method: 'POST', headers: hHdr, body: JSON.stringify({}),
  });
  assert.equal(hostStart.status, 200);
  assert.equal(hostStart.json.room.stageStatus, 'open');
});

// ============================================================================
// 6. ADMIN RPG CONTENT CMS, LIVE OVERRIDES, AUDIT LOGS & REAL RPG ANALYTICS
// ============================================================================
test('Admin CMS & RPG Analytics: RBAC guard, Question CRUD, Level Override preview & real SQL metrics', async () => {
  const normalPlayer = await createPlayer('NormalUser01');
  const pHdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${normalPlayer.token}` };

  // Non-admin blocked on all new RPG admin endpoints
  assert.equal((await api('/api/admin/analytics/rpg', { headers: pHdr })).status, 403);
  assert.equal((await api('/api/admin/content/questions', { headers: pHdr })).status, 403);
  assert.equal((await api('/api/admin/content/overrides', { headers: pHdr })).status, 403);

  // Admin login
  const admLogin = await api('/api/admin/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RpgAdmin', password: 'StrongRpgAdminPassword123!' }),
  });
  assert.equal(admLogin.status, 200);
  const aHdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${admLogin.json.token}` };

  // Question Bank CRUD + validation
  const badQ = await api('/api/admin/content/questions', {
    method: 'POST', headers: aHdr,
    body: JSON.stringify({ category: 'math', difficulty: 2, prompt: '2+2?', options: ['3', '4'], correctAnswer: '999', explanation: 'bad' }),
  });
  assert.equal(badQ.status, 400, 'Must reject question whose correctAnswer is not in options');

  const newQ = await api('/api/admin/content/questions', {
    method: 'POST', headers: aHdr,
    body: JSON.stringify({
      category: 'logic', difficulty: 2,
      prompt: 'Which number comes next: 3, 6, 12, 24, ?',
      options: ['36', '48', '30', '42'],
      correctAnswer: '48',
      explanation: 'Each term doubles the previous number (24 × 2 = 48).',
      status: 'published',
    }),
  });
  assert.equal(newQ.status, 200);
  const qid = newQ.json.question.questionId;
  assert.ok(qid);

  const delQ = await api(`/api/admin/content/questions/${encodeURIComponent(qid)}`, {
    method: 'DELETE', headers: aHdr,
  });
  assert.equal(delQ.status, 200);

  // Campaign Level Override saves, previews & immediately applies to AdventureProgressionService.getLevelDef
  const ovRes = await api('/api/admin/content/overrides', {
    method: 'PUT', headers: aHdr,
    body: JSON.stringify({
      entityType: 'campaign_level',
      entityId: 'lvl_10',
      status: 'published',
      payload: { title: 'Festival Rootguard Trial', rewards: { stars: 333, xp: 444 } },
    }),
  });
  assert.equal(ovRes.status, 200);
  assert.equal(ovRes.json.preview.title, 'Festival Rootguard Trial');
  assert.equal(ovRes.json.preview.rewards.stars, 333);
  assert.equal(AdventureProgressionService.getLevelDef(10).title, 'Festival Rootguard Trial');

  // Clean up override and confirm fallback restores
  await api('/api/admin/content/overrides/campaign_level/lvl_10', { method: 'DELETE', headers: aHdr });
  assert.notEqual(AdventureProgressionService.getLevelDef(10).title, 'Festival Rootguard Trial');

  // Real RPG Analytics computed strictly from SQLite records generated during above tests
  const rpgStats = await api('/api/admin/analytics/rpg', { headers: aHdr });
  assert.equal(rpgStats.status, 200);
  assert.ok(rpgStats.json.adventure.levelsCompleted >= 10, 'Real adventure completions recorded');
  assert.ok(rpgStats.json.quests.accepted >= 3, 'Real quest accept funnel recorded');
  assert.ok(rpgStats.json.quests.later >= 1, 'Real quest Later action recorded');
  assert.ok(rpgStats.json.quests.skipped >= 1, 'Real quest Skip action recorded');
  assert.ok(rpgStats.json.quests.claimed >= 3, 'Real quest Claim action recorded');
  assert.ok(rpgStats.json.educational.totalAttempts >= 3, 'Real quiz attempts recorded');
  assert.equal(rpgStats.json.educational.accuracyPct, 100);
  assert.ok(rpgStats.json.multiplayerObjectives.teamZoneCaptures >= 1, 'Real team zone captures recorded');
  assert.ok(rpgStats.json.multiplayerObjectives.teamRelicsDelivered >= 1, 'Real team relic deliveries recorded');
  assert.ok(rpgStats.json.multiplayerObjectives.privateRoomsCreated >= 1, 'Real private room creation recorded');
  assert.ok(rpgStats.json.multiplayerObjectives.privateInvitesSent >= 1, 'Real private room invite recorded');

  // Audit logs captured admin actions
  const audits = await api('/api/admin/audit-logs', { headers: aHdr });
  assert.equal(audits.status, 200);
  const actions = audits.json.adminLogs.map(l => l.action);
  assert.ok(actions.includes('question_upserted'));
  assert.ok(actions.includes('content_override_saved'));
});
