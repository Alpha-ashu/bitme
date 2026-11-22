export class AudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicEnabled: boolean = false;
  private musicTimer: any = null;
  private musicStep: number = 0;

  // Granular Volume Channels (0 - 100)
  private masterVolume: number = 80;
  private sfxVolume: number = 85;
  private musicVolume: number = 60;

  // Environmental & Feedback Toggles
  private ambientEnabled: boolean = true;
  private ambientTimer: any = null;
  private uiClicksEnabled: boolean = true;
  private hapticsEnabled: boolean = true;

  // Upbeat, calm copyright-free pentatonic melody sequence
  private melodyNotes: number[] = [
    523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 880.00, 783.99,
    659.25, 587.33, 523.25, 440.00, 523.25, 659.25, 783.99, 659.25
  ];

  constructor() {
    // AudioContext initialized on user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Volume Calculation Helpers ---
  private getSfxGain(baseGain: number = 1.0): number {
    if (this.isMuted) return 0;
    const master = Math.max(0, Math.min(100, this.masterVolume)) / 100;
    const sfx = Math.max(0, Math.min(100, this.sfxVolume)) / 100;
    return baseGain * master * sfx;
  }

  private getMusicGain(baseGain: number = 1.0): number {
    if (!this.musicEnabled) return 0;
    const master = Math.max(0, Math.min(100, this.masterVolume)) / 100;
    const music = Math.max(0, Math.min(100, this.musicVolume)) / 100;
    return baseGain * master * music;
  }

  // --- Volume & Channel Controls ---
  public setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(100, v));
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(100, v));
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(100, v));
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setAmbientEnabled(on: boolean): void {
    this.ambientEnabled = on;
    if (!on) this.stopAmbient();
    else this.startAmbient();
  }

  public isAmbientEnabled(): boolean {
    return this.ambientEnabled;
  }

  public setUiClicksEnabled(on: boolean): void {
    this.uiClicksEnabled = on;
  }

  public isUiClicksEnabled(): boolean {
    return this.uiClicksEnabled;
  }

  public setHapticsEnabled(on: boolean): void {
    this.hapticsEnabled = on;
  }

  public isHapticsEnabled(): boolean {
    return this.hapticsEnabled;
  }

  public vibrate(pattern: number | number[] = 20): void {
    if (!this.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch { /* unsupported or user gesture denied */ }
    }
  }

  // SFX mute toggle
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) this.playChime();
    return this.isMuted;
  }

  public setSfxEnabled(on: boolean): void {
    this.isMuted = !on;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // --- Background Music ---
  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
    if (on) this.ensureMusic();
    else this.stopMusic();
  }

  public ensureMusic() {
    if (!this.musicEnabled || this.musicTimer) return;
    this.initCtx();
    if (!this.ctx) return;
    const tryStart = () => {
      if (this.musicEnabled && !this.musicTimer && this.ctx && this.ctx.state === 'running') this.startMusicLoop();
    };
    if (this.ctx.state === 'running') tryStart();
    else this.ctx.resume().then(tryStart).catch(() => { /* retries on next gesture */ });
  }

  public startMusic() {
    this.ensureMusic();
  }

  private startMusicLoop() {
    if (this.musicTimer) return;

    // Gentle soothing pentatonic notes
    this.musicTimer = setInterval(() => {
      if (!this.musicEnabled || !this.ctx) return;
      const gainVal = this.getMusicGain(0.045);
      if (gainVal <= 0.0001) return;

      const freq = this.melodyNotes[this.musicStep % this.melodyNotes.length];
      this.musicStep++;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.5, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
      } catch { /* */ }
    }, 320);
  }

  public stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  // --- Serene Ambient Atmosphere Loop ---
  public startAmbient() {
    if (this.ambientTimer || !this.ambientEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    // Play subtle soft wind chimes every 4.5 seconds
    this.ambientTimer = setInterval(() => {
      if (!this.ambientEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const gainVal = this.getSfxGain(0.02);
      if (gainVal <= 0.0001) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;
        const notes = [1046.5, 1174.66, 1318.51, 1567.98];
        const randomNote = notes[Math.floor(Math.random() * notes.length)];

        osc.type = 'sine';
        osc.frequency.setValueAtTime(randomNote, now);
        osc.frequency.exponentialRampToValueAtTime(randomNote * 0.98, now + 1.2);

        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 1.2);
      } catch { /* */ }
    }, 4500);
  }

  public stopAmbient() {
    if (this.ambientTimer) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  // --- Interactive Audio Test / Preview Handlers ---
  public testSfx() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const gainVal = Math.max(0.01, (this.masterVolume / 100) * (this.sfxVolume / 100) * 0.25);

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.14); // A5

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch { /* */ }
  }

  public testMusic() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const gainVal = Math.max(0.008, (this.masterVolume / 100) * (this.musicVolume / 100) * 0.08);
    const chords = [523.25, 659.25, 783.99]; // C5, E5, G5

    chords.forEach((freq, idx) => {
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const t = now + idx * 0.12;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(gainVal, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(t);
        osc.stop(t + 0.26);
      } catch { /* */ }
    });
  }

  // --- Sound Effects ---
  public playChime() {
    const gainVal = this.getSfxGain(0.2);
    if (gainVal <= 0.0001) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(987.77, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch { /* */ }
  }

  public playClick() {
    if (!this.uiClicksEnabled || this.isMuted) return;
    const gainVal = this.getSfxGain(0.14);
    if (gainVal <= 0.0001) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch { /* */ }
  }

  public playEat() {
    const gainVal = this.getSfxGain(0.2);
    if (gainVal <= 0.0001) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.5, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch { /* */ }
  }

  public playHit() {
    const gainVal = this.getSfxGain(0.35);
    if (gainVal <= 0.0001) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch { /* */ }
  }

  public playDeath() {
    const gainVal = this.getSfxGain(0.3);
    if (gainVal <= 0.0001) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch { /* */ }
  }

  public playFanfare() {
    const gainVal = this.getSfxGain(0.24);
    if (gainVal <= 0.0001) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const startTime = this.ctx!.currentTime + idx * 0.1;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(gainVal, startTime);
        gain.gain.exponentialRampToValueAtTime(0.005, startTime + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.2);
      } catch { /* */ }
    });
  }
}

export const audio = new AudioSystem();
