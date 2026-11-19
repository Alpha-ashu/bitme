import { api, setPlayerToken } from '../api/ApiClient';
import { svgAvatarBadge, svgCloseX, svgFoodPreview, svgSerpentCrest } from '../components/CartoonUi';
import { esc } from '../utils/escapeHtml';
import { AppContext, ONB_AVATARS, ONB_COUNTRIES, ONB_LANGUAGES, TUTORIAL_SLIDES } from './types';

export function renderSplashScreen(root: HTMLElement, statusText = 'Connecting to CoilQuest…') {
  root.innerHTML = `
    <div class="splash-shell">
      <div class="splash-card">
        <div class="splash-crest">${svgSerpentCrest(96)}</div>
        <h1>COILQUEST</h1>
        <p class="splash-tag">Explore. Evolve. Conquer.</p>
        <div class="splash-loader"><div class="splash-loader-bar"></div></div>
        <small class="splash-status">${esc(statusText)}</small>
      </div>
    </div>
  `;
}

export function showPlayerAuthModal(
  ctx: AppContext,
  initialTab: 'login' | 'register' | 'upgrade' = 'login',
  onSuccess?: () => void
) {
  document.getElementById('player-auth-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'player-auth-modal';
  overlay.className = 'modal-backdrop';

  let tab: 'login' | 'register' | 'upgrade' = initialTab;
  if (tab === 'upgrade' && !ctx.state.isGuest) tab = 'login';
  let errorMsg = '';

  const renderInner = () => {
    const title = tab === 'upgrade' ? 'Save Progress' : tab === 'register' ? 'Sign Up' : 'Sign In';
    overlay.innerHTML = `
      <div class="panel game-wood-rim modal-card auth-card">
        <button id="auth-close" class="close-badge crimson" aria-label="Close">${svgCloseX()}</button>
        <div class="ribbon-wrap"><div class="ribbon-plaque">${title}</div></div>
        <div class="pill-group" style="justify-content:center;margin-bottom:12px">
          <button class="btn btn-xs ${tab === 'login' ? 'btn-primary' : 'btn-soft'}" data-atab="login">Sign In</button>
          <button class="btn btn-xs ${tab === 'register' ? 'btn-primary' : 'btn-soft'}" data-atab="register">Register</button>
          ${ctx.state.isGuest ? `<button class="btn btn-xs ${tab === 'upgrade' ? 'btn-gold' : 'btn-soft'}" data-atab="upgrade">Save Guest</button>` : ''}
        </div>
        ${errorMsg ? `<div class="alert-error">${esc(errorMsg)}</div>` : ''}
        <form id="player-auth-form" class="stack-form">
          <label>Username (3-16 chars, A-Z, 0-9, _)
            <input id="pa-user" class="amber-input" type="text" required minlength="3" maxlength="16" autocomplete="username" placeholder="EmeraldCoils" />
          </label>
          ${tab !== 'login' ? `
            <label>Email
              <input id="pa-email" class="amber-input" type="email" required autocomplete="email" placeholder="you@example.com" />
            </label>
          ` : ''}
          <label>Password ${tab === 'login' ? '' : '(min 6 characters)'}
            <input id="pa-pass" class="amber-input" type="password" required minlength="${tab === 'login' ? 4 : 6}" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}" placeholder="••••••••" />
          </label>
          <button type="submit" class="btn btn-primary btn-block">
            ${tab === 'upgrade' ? 'Upgrade & Keep All Stars/Progress' : tab === 'register' ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        <div class="auth-footer-links">
          <button id="pa-guest-btn" class="btn btn-xs btn-blue">Play Quick Guest</button>
          <button id="pa-admin-link" class="btn btn-xs btn-ghost">Admin Portal →</button>
        </div>
      </div>
    `;

    overlay.querySelector('#auth-close')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll<HTMLElement>('[data-atab]').forEach(b => {
      b.addEventListener('click', () => {
        tab = b.dataset.atab as any;
        errorMsg = '';
        renderInner();
      });
    });

    overlay.querySelector('#pa-admin-link')?.addEventListener('click', () => {
      overlay.remove();
      window.location.hash = '#/admin';
      ctx.setScreen('admin');
    });

    overlay.querySelector('#pa-guest-btn')?.addEventListener('click', async () => {
      const r = await api('/api/auth/guest', { method: 'POST' });
      if (!r.ok) { errorMsg = r.data?.error || 'Guest creation failed'; renderInner(); return; }
      setPlayerToken(r.data.token);
      overlay.remove();
      await ctx.refreshProfile();
      ctx.toast(`Welcome, ${r.data.user.username}!`);
      onSuccess?.();
    });

    overlay.querySelector('#player-auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (overlay.querySelector('#pa-user') as HTMLInputElement).value.trim();
      const email = (overlay.querySelector('#pa-email') as HTMLInputElement | null)?.value.trim() || '';
      const password = (overlay.querySelector('#pa-pass') as HTMLInputElement).value;
      const endpoint = tab === 'upgrade' ? '/api/auth/upgrade' : tab === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = tab === 'login' ? { username, password } : { username, email, password };
      const res = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) {
        errorMsg = res.data?.error || 'Authentication failed';
        renderInner();
        return;
      }
      setPlayerToken(res.data.token);
      overlay.remove();
      await ctx.refreshProfile();
      ctx.toast(tab === 'upgrade' ? 'Account upgraded & saved!' : `Welcome back, ${res.data.user.username}!`);
      onSuccess?.();
    });
  };

  renderInner();
  document.body.appendChild(overlay);
}

export function showOnboardingModal(ctx: AppContext) {
  if (localStorage.getItem('ap_onboarded_v2') === '1') return;
  document.getElementById('onboard-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'onboard-modal';
  overlay.className = 'modal-backdrop';
  let avatar = ONB_AVATARS[0];
  let errorMsg = '';

  const draw = () => {
    overlay.innerHTML = `
      <div class="panel game-wood-rim modal-card auth-card">
        <div class="ribbon-wrap"><div class="ribbon-plaque green">Welcome to CoilQuest</div></div>
        <h2 style="text-align:center">Choose Explorer Look</h2>
        ${errorMsg ? `<div class="alert-error">${esc(errorMsg)}</div>` : ''}
        <div class="avatar-picker">
          ${ONB_AVATARS.map(av => `<button type="button" class="av-opt ${av === avatar ? 'active' : ''}" data-av="${esc(av)}">${svgAvatarBadge(av, 'Forest', undefined, 36)}</button>`).join('')}
        </div>
        <form id="onb-form" class="stack-form">
          <label>Nickname
            <input id="onb-name" class="amber-input" type="text" required minlength="3" maxlength="16" value="${esc(ctx.state.profile?.displayName || '')}" placeholder="EmeraldPrince" />
          </label>
          <div class="form-row-2">
            <label>Region
              <select id="onb-country">${ONB_COUNTRIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
            </label>
            <label>Language
              <select id="onb-lang">${ONB_LANGUAGES.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('')}</select>
            </label>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Start Adventure</button>
          <button type="button" id="onb-existing" class="btn btn-soft btn-block">Already registered? Sign In</button>
        </form>
      </div>
    `;

    overlay.querySelectorAll<HTMLElement>('[data-av]').forEach(btn => {
      btn.addEventListener('click', () => { avatar = btn.dataset.av!; draw(); });
    });
    overlay.querySelector('#onb-existing')?.addEventListener('click', () => {
      localStorage.setItem('ap_onboarded_v2', '1');
      overlay.remove();
      showPlayerAuthModal(ctx, 'login');
    });
    overlay.querySelector('#onb-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (overlay.querySelector('#onb-name') as HTMLInputElement).value.trim();
      const country = (overlay.querySelector('#onb-country') as HTMLSelectElement).value;
      const language = (overlay.querySelector('#onb-lang') as HTMLSelectElement).value;
      const r = await api('/api/player/edit-profile', {
        method: 'POST',
        body: JSON.stringify({ displayName: name, avatar, country, region: country }),
      });
      if (!r.ok && r.data?.error) {
        errorMsg = r.data.error;
        draw();
        return;
      }
      localStorage.setItem('ap_onboarded_v2', '1');
      localStorage.setItem('ap_lang', language);
      overlay.remove();
      await ctx.refreshProfile();
      ctx.toast(`Welcome to Emerald Hollow, ${name}!`);
    });
  };
  draw();
  document.body.appendChild(overlay);
}

export function showTutorialModal() {
  document.getElementById('tut-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'tut-modal';
  overlay.className = 'modal-backdrop';
  let idx = 0;

  const draw = () => {
    const s = TUTORIAL_SLIDES[idx];
    overlay.innerHTML = `
      <div class="panel game-wood-rim modal-card">
        <button id="tut-x" class="close-badge crimson" aria-label="Close">${svgCloseX()}</button>
        <div class="ribbon-wrap"><div class="ribbon-plaque blue">Guide (${idx + 1}/${TUTORIAL_SLIDES.length})</div></div>
        <div class="tut-body">
          ${svgFoodPreview('rare_egg', 52)}
          <h3 style="margin-top:8px">${esc(s.title)}</h3>
          <p class="subtitle">${esc(s.text)}</p>
        </div>
        <div class="form-actions" style="justify-content:center">
          <button id="tut-prev" class="btn btn-soft" ${idx === 0 ? 'disabled' : ''}>← Back</button>
          <button id="tut-next" class="btn btn-primary">${idx === TUTORIAL_SLIDES.length - 1 ? 'Got It!' : 'Next →'}</button>
        </div>
      </div>
    `;
    overlay.querySelector('#tut-x')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#tut-prev')?.addEventListener('click', () => { idx = Math.max(0, idx - 1); draw(); });
    overlay.querySelector('#tut-next')?.addEventListener('click', () => {
      if (idx >= TUTORIAL_SLIDES.length - 1) overlay.remove();
      else { idx++; draw(); }
    });
  };
  draw();
  document.body.appendChild(overlay);
}

