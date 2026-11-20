import { api, resolveMediaUrl } from '../api/ApiClient';

export type AdUnit = 'rewarded' | 'interstitial' | 'banner' | 'appOpen';
export type AdPlacement = 'home_screen' | 'between_sessions' | 'game_over' | 'story_menu' | 'rewarded_opt_in';

export interface ServedAd {
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  destinationUrl: string;
  placement: AdPlacement;
}

export interface AdConfig {
  enabled: boolean;
  appId: string;
  units: Record<AdUnit, string>;
  testMode: boolean;
}

export class AdService {
  private cfg: AdConfig = {
    enabled: false,
    appId: '',
    units: { rewarded: '', interstitial: '', banner: '', appOpen: '' },
    testMode: true,
  };
  private cache: Map<string, { at: number; ads: ServedAd[] }> = new Map();
  private rewardedWatchAdId: string | undefined;

  configure(partial: Partial<AdConfig>): void {
    this.cfg = { ...this.cfg, ...partial };
  }

  attachPlugin(_plugin: any): void { /* Native AdMob bridge hook */ }

  isEnabled(): boolean {
    return this.cfg.enabled;
  }

  clearCache() {
    this.cache.clear();
  }

  async fetchPlacement(placement: AdPlacement, force = false): Promise<ServedAd[]> {
    const cached = this.cache.get(placement);
    if (!force && cached && Date.now() - cached.at < 15_000) {
      return cached.ads;
    }
    const res = await api(`/api/ads/serve?placement=${encodeURIComponent(placement)}`);
    const adsList: ServedAd[] = res.ok && Array.isArray(res.data?.ads)
      ? res.data.ads.map((a: any) => ({ ...a, mediaUrl: resolveMediaUrl(a.mediaUrl) }))
      : [];
    this.cache.set(placement, { at: Date.now(), ads: adsList });
    return adsList;
  }

  async track(adId: string, placement: AdPlacement, eventType: 'impression' | 'click'): Promise<void> {
    if (!adId) return;
    await api('/api/ads/track', {
      method: 'POST',
      body: JSON.stringify({ adId, placement, eventType }),
    });
  }

  async startRewardedWatch(): Promise<{ ok: boolean; tokenId?: string; minWatchMs: number; ad?: ServedAd; error?: string }> {
    const adsList = await this.fetchPlacement('rewarded_opt_in', true);
    const ad = adsList[0];
    this.rewardedWatchAdId = ad?.id;
    let tokenId: string | undefined;
    let minWatchMs = 4000;
    try {
      const res = await api('/api/ads/reward-start', {
        method: 'POST',
        body: JSON.stringify({ adId: ad?.id }),
      });
      if (res.ok && res.data?.tokenId) {
        tokenId = res.data.tokenId;
        minWatchMs = res.data.minWatchMs ?? 4000;
      }
    } catch (e) {
      // Offline fallback
    }

    if (!tokenId) {
      tokenId = `local_rew_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    if (ad?.id) void this.track(ad.id, 'rewarded_opt_in', 'impression');
    return { ok: true, tokenId, minWatchMs, ad };
  }

  getLastRewardedAdId(): string | undefined {
    return this.rewardedWatchAdId;
  }

  async showRewarded(simulate: (done: () => void) => void): Promise<boolean> {
    return new Promise<boolean>(resolve => simulate(() => resolve(true)));
  }

  async showInterstitial(): Promise<void> { /* Safe between-screen hook only */ }
  async showBanner(): Promise<void> { /* Managed per placement container */ }
  async hideBanner(): Promise<void> { /* Managed per placement container */ }
}

export const ads = new AdService();
