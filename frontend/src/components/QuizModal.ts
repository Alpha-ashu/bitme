import { imgBundleSprite, svgCloseX, svgNpcPortrait } from './CartoonUi';
import { esc } from '../utils/escapeHtml';

export interface NpcPopupHandlers {
  onAccept: () => Promise<void> | void;
  onLater: () => Promise<void> | void;
  onSkip: () => Promise<void> | void;
  onClaim: () => Promise<void> | void;
}

/**
 * Non-destructive compact NPC Quest Encounter Popup (mounts into #npc-modal-slot without touching <canvas>).
 * Displays NPC name/role, Quest title, description, Difficulty, Expected duration, Reward preview,
 * and Accept Quest / Later / Skip (or Claim Reward) actions.
 */
export function renderNpcEncounterPopup(
  slot: HTMLElement,
  encounter: any | null,
  handlers: NpcPopupHandlers
): void {
  if (!encounter) {
    slot.innerHTML = '';
    return;
  }

  const diffStars = '★'.repeat(Math.max(1, Math.min(5, Number(encounter.difficultyTier) || 1)))
    + '☆'.repeat(Math.max(0, 5 - Math.min(5, Number(encounter.difficultyTier) || 1)));
  const durSec = Number(encounter.expectedDurationSec) || 45;
  const durLabel = durSec >= 60 ? `~${Math.ceil(durSec / 60)}m` : `~${durSec}s`;
  const rw = encounter.rewards || {};
  const isClaimable = !!encounter.canClaim || encounter.questState === 'CLAIMABLE';
  const quota = encounter.npcQuota;
  const doneCnt = quota ? Number(quota.completedInCycle || 0) : 0;
  const maxCnt = quota ? Number(quota.maxPerCycle || 5) : 5;
  const totalDone = quota ? Number(quota.totalCompleted || 0) : 0;
  const onCooldown = !!quota?.onCooldown;
  const cdSec = Number(quota?.cooldownRemainingSec || 0);
  const cdMin = Math.floor(cdSec / 60);
  const cdRem = cdSec % 60;
  const cdText = `${cdMin}m ${String(cdRem).padStart(2, '0')}s`;

  const quotaStripHtml = `
    <div class="npc-quota-bar ${onCooldown ? 'resting' : ''}">
      <div class="npc-quota-top">
        <span>Quest Master Progress</span>
        <b>${doneCnt}/${maxCnt} Tasks${totalDone > doneCnt ? ` · ${totalDone} Total` : ''}</b>
      </div>
      <div class="npc-quota-pips" aria-label="${doneCnt} of ${maxCnt} tasks completed">
        ${Array.from({ length: maxCnt }, (_, i) => `<span class="qpip ${i < doneCnt ? 'done' : ''}"></span>`).join('')}
      </div>
      ${onCooldown ? `<small class="npc-cd-note">All ${maxCnt} tasks finished! Next quests unlock in <b>${cdText}</b>.</small>` : ''}
    </div>
  `;

  slot.innerHTML = `
    <div class="npc-encounter-backdrop" id="npc-encounter-modal">
      <div class="panel game-wood-rim npc-encounter-card">
        <button type="button" id="npc-pop-close" class="close-badge" aria-label="Close">${svgCloseX()}</button>
        <div class="ribbon-wrap"><div class="ribbon-plaque ${onCooldown ? 'wood-ribbon' : 'green'}">${esc(encounter.npcName || 'Guide')}</div></div>

        <div class="npc-pop-header">
          <div class="npc-pop-avatar">${svgNpcPortrait(encounter.npcRole || 'elder', 46)}</div>
          <div style="flex:1;min-width:0">
            <div class="npc-pop-meta">
              <span class="pill">${esc((encounter.questType || 'quest').replace('_', ' ').toUpperCase())}</span>
              ${!onCooldown ? `<span class="pill" title="Difficulty">${diffStars}</span><span class="pill">${durLabel}</span>` : `<span class="pill">30m Cooldown</span>`}
            </div>
            <h3>${esc(encounter.title || 'Adventure Quest')}</h3>
          </div>
        </div>

        ${quotaStripHtml}

        <p class="npc-pop-desc">${esc(encounter.description || encounter.greeting || '')}</p>

        ${!onCooldown ? `
          <div class="npc-reward-strip">
            <span>${imgBundleSprite('ui_star_wood', 16)} <b>+${rw.stars || 0}</b> Stars</span>
            <span><b>+${rw.xp || 0}</b> XP</span>
            <span><b>+${rw.evoXp || 0}</b> Evo</span>
            ${rw.tickets ? `<span>${imgBundleSprite('pirate_map', 16)} <b>+${rw.tickets}</b></span>` : ''}
          </div>
          <div class="npc-deploy-hint">Accepting deploys you safely to a fresh area away from rivals. Rewards auto-save to your Reward Box!</div>
        ` : ''}

        <div class="npc-pop-actions">
          ${onCooldown
            ? `<button type="button" id="npc-btn-later" class="btn btn-primary btn-block">Got It — Explore Other Guides</button>`
            : isClaimable
              ? `<button type="button" id="npc-btn-claim" class="btn btn-gold btn-block">Collect Reward</button>`
              : encounter.canAccept
                ? `<button type="button" id="npc-btn-accept" class="btn btn-primary btn-block">Accept &amp; Deploy to Fresh Area</button>`
                : `<button type="button" id="npc-btn-later" class="btn btn-primary btn-block">Continue Active Quest</button>`}
          ${!onCooldown ? `
            <div class="npc-pop-subactions">
              <button type="button" id="npc-btn-later-2" class="btn btn-soft btn-sm">Later</button>
              ${!isClaimable && encounter.canAccept ? `<button type="button" id="npc-btn-skip" class="btn btn-ghost btn-sm">Skip</button>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  let busy = false;
  const runOnce = (fn: () => Promise<void> | void) => async () => {
    if (busy) return;
    busy = true;
    try { await fn(); } finally { busy = false; }
  };

  slot.querySelector('#npc-btn-accept')?.addEventListener('click', runOnce(handlers.onAccept));
  slot.querySelector('#npc-btn-claim')?.addEventListener('click', runOnce(handlers.onClaim));
  slot.querySelector('#npc-btn-later')?.addEventListener('click', runOnce(handlers.onLater));
  slot.querySelector('#npc-btn-later-2')?.addEventListener('click', runOnce(handlers.onLater));
  slot.querySelector('#npc-pop-close')?.addEventListener('click', runOnce(handlers.onLater));
  slot.querySelector('#npc-btn-skip')?.addEventListener('click', runOnce(handlers.onSkip));
}

export interface QuizModalHandlers {
  onSubmitAnswer: (quizSessionId: string, questionId: string, answer: string, responseMs: number) => Promise<any>;
  onClose: () => void;
  onClaimReady?: () => Promise<void>;
  onRetryLevel?: () => Promise<void>;
}

/**
 * Accessible, non-destructive Educational Quiz & Puzzle Modal (Word, Math, Memory, Logic).
 * Never stores or inspects correct answers client-side — strictly submits to the server and renders
 * authoritative feedback, educational explanation, progress, and final score/reward summary.
 */
export function renderQuizModal(
  slot: HTMLElement,
  initialQuestion: any | null,
  handlers: QuizModalHandlers
): void {
  if (!initialQuestion) {
    slot.innerHTML = '';
    return;
  }

  let currentQ = initialQuestion;
  let shownAt = Date.now();
  let timerHandle: any = null;
  let lastResult: any = null;
  let submitting = false;

  const stopTimer = () => {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  };

  const drawQuestion = () => {
    stopTimer();
    if (!currentQ) {
      slot.innerHTML = '';
      return;
    }

    const catLabel = String(currentQ.category || 'quiz').toUpperCase();
    const qNum = (currentQ.index || 0) + 1;
    const total = currentQ.total || 3;
    const diffStars = '★'.repeat(Math.max(1, Math.min(5, Number(currentQ.difficulty) || 1)));
    let timeLeft = currentQ.untimed ? 0 : (Number(currentQ.timeLimitSec) || 25);

    slot.innerHTML = `
      <div class="npc-encounter-backdrop" id="quiz-modal">
        <div class="panel game-wood-rim quiz-card">
          <button type="button" id="quiz-close-x" class="close-badge" aria-label="Close Quiz">${svgCloseX()}</button>
          <div class="ribbon-wrap"><div class="ribbon-plaque blue">${esc(catLabel)} TRIAL · ${qNum}/${total}</div></div>

          <div class="quiz-meta-row">
            <span class="pill">Difficulty ${diffStars}</span>
            <span class="pill">Score ${currentQ.correctCount || 0}/${total}</span>
            <span class="pill" id="quiz-timer-chip">${currentQ.untimed ? '∞ Relaxed' : `⏱ ${timeLeft}s`}</span>
          </div>

          <div class="hud-bar"><div style="width:${Math.round(((qNum - 1) / Math.max(1, total)) * 100)}%"></div></div>

          <div class="quiz-question-box">
            <p class="quiz-prompt">${esc(currentQ.questionText)}</p>
          </div>

          <div class="quiz-options-grid" id="quiz-options">
            ${(currentQ.options || []).map((opt: string, i: number) => `
              <button type="button" class="quiz-opt-btn" data-opt-idx="${i}" data-opt-val="${esc(opt)}">
                <span class="quiz-opt-letter">${String.fromCharCode(65 + i)}</span>
                <span class="quiz-opt-text">${esc(opt)}</span>
              </button>
            `).join('')}
          </div>

          <div id="quiz-feedback-area"></div>
        </div>
      </div>
    `;

    shownAt = Date.now();

    if (!currentQ.untimed && timeLeft > 0) {
      timerHandle = setInterval(() => {
        timeLeft = Math.max(0, timeLeft - 1);
        const chip = slot.querySelector('#quiz-timer-chip');
        if (chip) chip.textContent = `⏱ ${timeLeft}s`;
        if (timeLeft <= 0) {
          stopTimer();
        }
      }, 1000);
    }

    slot.querySelector('#quiz-close-x')?.addEventListener('click', () => {
      stopTimer();
      handlers.onClose();
    });

    slot.querySelectorAll<HTMLButtonElement>('[data-opt-val]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (submitting || lastResult) return;
        submitting = true;
        stopTimer();
        const val = btn.dataset.optVal || '';
        const elapsed = Date.now() - shownAt;
        slot.querySelectorAll<HTMLButtonElement>('[data-opt-val]').forEach(b => { b.disabled = true; });

        const res = await handlers.onSubmitAnswer(currentQ.quizSessionId, currentQ.questionId, val, elapsed);
        submitting = false;
        if (!res || !res.ok) {
          slot.querySelectorAll<HTMLButtonElement>('[data-opt-val]').forEach(b => { b.disabled = false; });
          const fb = slot.querySelector('#quiz-feedback-area');
          if (fb) fb.innerHTML = `<div class="quiz-fb wrong">${esc(res?.error || 'Could not submit answer')}</div>`;
          return;
        }

        lastResult = res;
        btn.classList.add(res.isCorrect ? 'correct' : 'wrong');
        if (!res.isCorrect && res.correctAnswer) {
          slot.querySelectorAll<HTMLButtonElement>('[data-opt-val]').forEach(b => {
            if ((b.dataset.optVal || '').toLowerCase() === String(res.correctAnswer).toLowerCase()) {
              b.classList.add('correct');
            }
          });
        }

        const fb = slot.querySelector('#quiz-feedback-area');
        if (fb) {
          if (res.completed) {
            const passed = !!res.passed;
            const autoBoxed = !!res.questUpdate?.autoClaimedToBox;
            const claimable = !autoBoxed && (res.questUpdate?.session?.state === 'CLAIMABLE');
            const nextQuiz = res.questUpdate?.nextQuiz;
            fb.innerHTML = `
              <div class="quiz-fb ${res.isCorrect ? 'correct' : 'wrong'}">
                <strong>${res.isCorrect ? 'Correct!' : `Answer: ${esc(res.correctAnswer)}`}</strong>
                <p>${esc(res.explanation || '')}</p>
              </div>
              <div class="quiz-summary-bar">
                <span>${autoBoxed ? 'Sent to Reward Box!' : passed ? 'Trial Passed!' : 'Keep Trying!'} Score: <b>${res.correctCount}/${res.total}</b></span>
                ${claimable
                  ? `<button type="button" id="quiz-finish-claim" class="btn btn-gold btn-sm">Claim Reward</button>`
                  : nextQuiz
                    ? `<button type="button" id="quiz-next-stage" class="btn btn-primary btn-sm">Next Stage →</button>`
                    : passed
                      ? `<button type="button" id="quiz-done-btn" class="btn btn-primary btn-sm">Continue →</button>`
                      : `<button type="button" id="quiz-retry-btn" class="btn btn-primary btn-sm">Retry Trial</button>`}
              </div>
            `;
            fb.querySelector('#quiz-finish-claim')?.addEventListener('click', async () => {
              await handlers.onClaimReady?.();
              handlers.onClose();
            });
            fb.querySelector('#quiz-next-stage')?.addEventListener('click', () => {
              currentQ = nextQuiz;
              lastResult = null;
              drawQuestion();
            });
            fb.querySelector('#quiz-done-btn')?.addEventListener('click', () => handlers.onClose());
            fb.querySelector('#quiz-retry-btn')?.addEventListener('click', async () => {
              if (handlers.onRetryLevel) await handlers.onRetryLevel();
              else handlers.onClose();
            });
          } else {
            fb.innerHTML = `
              <div class="quiz-fb ${res.isCorrect ? 'correct' : 'wrong'}">
                <strong>${res.isCorrect ? '✓ Correct!' : `✗ Answer: ${esc(res.correctAnswer)}`}</strong>
                <p>${esc(res.explanation || '')}</p>
              </div>
              <button type="button" id="quiz-next-q" class="btn btn-primary btn-block" style="margin-top:8px">Next Question →</button>
            `;
            fb.querySelector('#quiz-next-q')?.addEventListener('click', () => {
              currentQ = res.nextQuestion;
              lastResult = null;
              drawQuestion();
            });
          }
        }
      });
    });
  };

  drawQuestion();
}

