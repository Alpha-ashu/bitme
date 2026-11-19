import { ads, AdPlacement, ServedAd } from '../game/AdService';
import { esc, safeUrl } from '../utils/escapeHtml';

const recordedImpressions = new Set<string>();

export function adSlotPlaceholder(placement: AdPlacement, className = ''): string {
  return `<div class="ad-slot ${esc(className)}" data-ad-placement="${esc(placement)}" style="display:none"></div>`;
}

/** Populate all declared non-gameplay ad slots inside `container` using live scheduled ads. */
export async function mountAdSlots(container: HTMLElement, sessionNonce = ''): Promise<void> {
  const slots = Array.from(container.querySelectorAll<HTMLElement>('[data-ad-placement]'));
  if (!slots.length) return;

  await Promise.all(slots.map(async (el) => {
    const placement = el.dataset.adPlacement as AdPlacement;
    if (!placement) return;
    const list = await ads.fetchPlacement(placement);
    const ad: ServedAd | undefined = list[0];
    if (!ad) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }

    const dest = safeUrl(ad.destinationUrl);
    const mediaSrc = safeUrl(ad.mediaUrl);
    if (!mediaSrc) {
      el.style.display = 'none';
      return;
    }

    el.style.display = 'block';
    const mediaHtml = ad.mediaType === 'video'
      ? `<video class="ad-media" src="${esc(mediaSrc)}" autoplay muted loop playsinline preload="metadata"></video>`
      : `<img class="ad-media" src="${esc(mediaSrc)}" alt="${esc(ad.title)}" loading="lazy" />`;

    el.innerHTML = `
      <div class="ad-card" data-ad-id="${esc(ad.id)}">
        <span class="ad-badge">SPONSORED</span>
        <div class="ad-media-wrap">${mediaHtml}</div>
        <div class="ad-copy">
          <strong>${esc(ad.title)}</strong>
          ${ad.description ? `<p>${esc(ad.description)}</p>` : ''}
        </div>
        ${dest ? `<a class="btn btn-sm ad-cta" href="${esc(dest)}" target="_blank" rel="noopener noreferrer">Visit ↗</a>` : ''}
      </div>
    `;

    const impKey = `${sessionNonce}:${placement}:${ad.id}`;
    if (!recordedImpressions.has(impKey)) {
      recordedImpressions.add(impKey);
      void ads.track(ad.id, placement, 'impression');
    }

    el.querySelector('.ad-cta')?.addEventListener('click', () => {
      void ads.track(ad.id, placement, 'click');
    });
    el.querySelector('.ad-media-wrap')?.addEventListener('click', () => {
      if (dest) {
        void ads.track(ad.id, placement, 'click');
        window.open(dest, '_blank', 'noopener,noreferrer');
      }
    });
  }));
}

