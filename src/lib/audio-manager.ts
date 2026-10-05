import { Howl, Howler } from "howler";
import {
  UI_SOUND_CATEGORIES,
  UI_SOUND_CUES,
  UI_SOUND_FILES,
  type UISound,
  type UISoundCategory,
} from "./ui-sound-catalog";

const STORAGE_KEY = "looma-ui-audio-v1";
const clamp = (value: number) => Math.min(1, Math.max(0, value));
export type AudioPreferences = {
  volume: number;
  muted: boolean;
  respectReducedMotion: boolean;
  categories: Record<UISoundCategory, number>;
};
const defaults: AudioPreferences = {
  volume: 0.18,
  muted: false,
  respectReducedMotion: true,
  categories: {
    interaction: 1,
    movement: 0.85,
    social: 1,
    message: 0.9,
    feedback: 1,
    notification: 0.85,
    premium: 0.9,
  },
};

function parsePreferences(raw: string | null): AudioPreferences {
  try {
    const data = JSON.parse(raw ?? "null") as Partial<AudioPreferences> | null;
    const categories = { ...defaults.categories };
    for (const category of Object.keys(UI_SOUND_CATEGORIES) as UISoundCategory[]) {
      const value = data?.categories?.[category];
      if (typeof value === "number" && Number.isFinite(value)) categories[category] = clamp(value);
    }
    return {
      volume:
        typeof data?.volume === "number" && Number.isFinite(data.volume)
          ? clamp(data.volume)
          : defaults.volume,
      muted: typeof data?.muted === "boolean" ? data.muted : defaults.muted,
      respectReducedMotion:
        typeof data?.respectReducedMotion === "boolean" ? data.respectReducedMotion : true,
      categories,
    };
  } catch {
    return { ...defaults, categories: { ...defaults.categories } };
  }
}

// Only this singleton owns Howls. Importing it during SSR does not load audio or
// access browser APIs. UI volume never changes media/video volume in Howler.
class AudioManager {
  private preferences = defaults;
  private sounds = new Map<keyof typeof UI_SOUND_FILES, Howl>();
  private listeners = new Set<() => void>();
  private lastCue = new Map<UISound, number>();
  private lastStart = -Infinity;
  private active: { howl: Howl; id: number; priority: number } | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private sequence = 0;
  private initialized = false;
  private gestureReceived = false;
  private reducedMotion = false;
  private cleanup: (() => void) | undefined;

  getSnapshot = () => this.preferences;
  getServerSnapshot = () => defaults;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  initialize() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    try {
      this.preferences = parsePreferences(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* Storage is optional. */
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = media.matches;
    const onMotion = () => {
      this.reducedMotion = media.matches;
      if (this.isSilent()) this.stop();
      this.emit();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      this.preferences = parsePreferences(event.newValue);
      this.stop();
      this.emit();
    };
    const unlock = (event: Event) => {
      if (!event.isTrusted) return;
      this.gestureReceived = true;
      // Resume only from a real gesture. Never queue stale cues for later unlock.
      if (Howler.ctx?.state === "suspended") void Howler.ctx.resume().catch(() => {});
    };
    const onVisibility = () => {
      if (document.hidden) this.stop();
    };
    media.addEventListener("change", onMotion);
    window.addEventListener("storage", onStorage);
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanup = () => {
      media.removeEventListener("change", onMotion);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    this.preload();
    this.emit();
  }

  preload() {
    if (typeof window === "undefined") return;
    for (const [file, src] of Object.entries(UI_SOUND_FILES)) {
      const key = file as keyof typeof UI_SOUND_FILES;
      if (this.sounds.has(key)) continue;
      try {
        const howl = new Howl({
          src: [src],
          preload: true,
          autoplay: false,
          loop: false,
          volume: 0,
          pool: 1,
          onplayerror: (id) => {
            howl.stop(id);
          },
          onloaderror: () => {
            howl.stop();
          },
        });
        this.sounds.set(key, howl);
      } catch {
        /* Missing audio support must never break an interaction. */
      }
    }
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
  private isSilent() {
    return (
      this.preferences.muted ||
      this.preferences.volume === 0 ||
      (this.preferences.respectReducedMotion && this.reducedMotion)
    );
  }

  setPreferences(patch: Partial<Omit<AudioPreferences, "categories">>) {
    const next = { ...this.preferences, ...patch };
    this.preferences = parsePreferences(JSON.stringify(next));
    this.save();
  }

  setCategoryVolume(category: UISoundCategory, volume: number) {
    if (!Number.isFinite(volume)) return;
    this.preferences = {
      ...this.preferences,
      categories: { ...this.preferences.categories, [category]: clamp(volume) },
    };
    this.save();
  }

  private save() {
    // Also cancel scheduled sounds when lowering volume or disabling a category.
    this.stop();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch {
      /* Private browsing. */
    }
    this.emit();
  }

  play(sound: UISound, options: { delayMs?: number; direction?: -1 | 1 } = {}) {
    if (!this.initialized || !this.gestureReceived || this.isSilent() || document.hidden)
      return false;
    if (Howler.noAudio || (Howler.usingWebAudio && Howler.ctx?.state !== "running")) return false;
    const cue = UI_SOUND_CUES[sound];
    const categoryVolume = this.preferences.categories[cue.category];
    const howl = this.sounds.get(cue.file);
    // Drop, rather than replay, an interaction that occurs before decoding finishes.
    if (!categoryVolume || !howl || howl.state() !== "loaded") return false;
    const now = performance.now();
    if (now - (this.lastCue.get(sound) ?? -Infinity) < cue.cooldown) return false;
    if (now - this.lastStart < 65 && cue.priority <= (this.active?.priority ?? 0)) return false;
    if (this.active?.howl.playing(this.active.id) && cue.priority < this.active.priority)
      return false;
    this.lastCue.set(sound, now);
    this.lastStart = now;
    this.stop();
    const sequence = this.sequence;
    const variation = "variation" in cue ? cue.variation : 0;
    const rate = cue.rate * (1 + (Math.random() - 0.5) * 2 * variation);
    const gain = cue.gain * (variation ? 0.96 + Math.random() * 0.04 : 1);
    const delay = Math.max(0, Math.min(100, options.delayMs ?? 0));
    const start = () => {
      this.startVoice(cue.file, gain, rate, cue.category, cue.priority, options.direction ?? 1);
      if ("followup" in cue) {
        this.schedule(
          () =>
            this.startVoice(
              cue.followup.file,
              cue.followup.gain,
              cue.followup.rate,
              cue.category,
              cue.priority,
              1,
            ),
          cue.followup.delay,
          sequence,
        );
      }
    };
    if (delay) this.schedule(start, delay, sequence);
    else start();
    return true;
  }

  private schedule(callback: () => void, delay: number, sequence: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (sequence === this.sequence && !document.hidden && !this.isSilent()) callback();
    }, delay);
    this.timers.add(timer);
  }

  private startVoice(
    file: keyof typeof UI_SOUND_FILES,
    gain: number,
    rate: number,
    category: UISoundCategory,
    priority: number,
    direction: number,
  ) {
    if (this.isSilent() || document.hidden || !this.preferences.categories[category]) return;
    if (Howler.noAudio || (Howler.usingWebAudio && Howler.ctx?.state !== "running")) return;
    const howl = this.sounds.get(file);
    if (!howl || howl.state() !== "loaded") return;
    if (this.active) this.active.howl.stop(this.active.id);
    try {
      // Set defaults before play so the first audio sample has the correct gain.
      howl.volume(this.preferences.volume * this.preferences.categories[category] * gain);
      howl.rate(rate);
      if (Howler.usingWebAudio) howl.stereo(category === "movement" ? direction * 0.12 : 0);
      const id = howl.play();
      this.active = { howl, id, priority };
    } catch {
      /* Browser policy or device availability can change mid-session. */
    }
  }

  stop() {
    this.sequence++;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    if (this.active) this.active.howl.stop(this.active.id);
    this.active = null;
  }

  dispose() {
    this.stop();
    this.cleanup?.();
    this.cleanup = undefined;
    this.sounds.forEach((howl) => howl.unload());
    this.sounds.clear();
    this.lastCue.clear();
    this.lastStart = -Infinity;
    this.gestureReceived = false;
    this.initialized = false;
  }
}

export const audioManager = new AudioManager();
if (import.meta.hot) import.meta.hot.dispose(() => audioManager.dispose());
