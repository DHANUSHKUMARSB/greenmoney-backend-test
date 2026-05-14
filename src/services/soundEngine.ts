import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../store';

export type SoundEvent = 
  // UI Interactions
  | 'tap_primary' | 'tap_secondary' | 'tap_destructive' | 'tap_nav'
  | 'swipe_glide' | 'swipe_pop' | 'swipe_delete'
  | 'modal_open' | 'modal_close'
  // Success/Error/Warning
  | 'success' | 'error' | 'warning' | 'achievement'
  // Transactions
  | 'income_added' | 'expense_added' | 'delete_confirmed'
  // Character Reactions
  | 'char_happy' | 'char_worried' | 'char_motivational'
  // System
  | 'sync_start' | 'sync_complete';

type SoundTheme = 'minimal' | 'modern' | 'futuristic' | 'soft' | 'playful';

const CDN_BASE = 'https://assets.mixkit.co/active_storage/sfx/';
const SOUNDS = {
  tap: CDN_BASE + '2568/2568-preview.mp3', // Soft pop
  success: CDN_BASE + '1435/1435-preview.mp3', // Uplifting chime
  error: CDN_BASE + '2572/2572-preview.mp3', // Low thump
  delete: CDN_BASE + '2571/2571-preview.mp3', // Downward slide
  swipe: CDN_BASE + '2568/2568-preview.mp3',
  sync: CDN_BASE + '1435/1435-preview.mp3',
};

// Emotional Mapping for different themes
const THEME_MAP: Record<SoundTheme, Partial<Record<SoundEvent, string>>> = {
  modern: {
    tap_primary: SOUNDS.tap,
    tap_secondary: SOUNDS.tap,
    tap_nav: SOUNDS.tap,
    success: SOUNDS.success,
    error: SOUNDS.error,
    delete_confirmed: SOUNDS.delete,
    income_added: SOUNDS.success,
    expense_added: SOUNDS.tap,
    swipe_glide: SOUNDS.swipe,
    achievement: SOUNDS.success,
  },
  minimal: {
    tap_primary: SOUNDS.tap,
    success: SOUNDS.success,
    swipe_glide: SOUNDS.swipe,
  },
  futuristic: {
    tap_primary: 'https://www.soundjay.com/buttons/button-16.mp3',
    success: 'https://www.soundjay.com/buttons/button-09.mp3',
    error: 'https://www.soundjay.com/buttons/button-10.mp3',
  },
  soft: {
    tap_primary: SOUNDS.tap,
    success: SOUNDS.success,
  },
  playful: {
    tap_primary: SOUNDS.tap,
    success: SOUNDS.success,
  }
};

class SoundEngine {
  private players: Map<string, AudioPlayer> = new Map();
  private lastPlayed: Record<string, number> = {};
  private currentTheme: SoundTheme = 'modern';

  async init() {
    try {
      const { soundTheme, soundEnabled } = useAppStore.getState();
      this.currentTheme = soundTheme;
      
      if (!soundEnabled) return;

      // Preload current theme core sounds
      const themeSounds = THEME_MAP[this.currentTheme];
      Object.entries(themeSounds).forEach(([event, url]) => {
        const player = createAudioPlayer(url as string);
        player.volume = 0.5;
        this.players.set(`${this.currentTheme}_${event}`, player);
      });

      console.log(`[SOUND-ENGINE]: Emotional system initialized with theme: ${this.currentTheme}`);
    } catch (e) {
      console.warn('[SOUND-ENGINE]: Initialization failed', e);
    }
  }

  async play(event: SoundEvent, customHaptic?: Haptics.ImpactFeedbackStyle | 'success' | 'error' | 'warning') {
    const state = useAppStore.getState();
    if (!state.soundEnabled && !state.hapticsEnabled) return;

    // 1. Adaptive Logic (Cooldown/Debounce)
    const now = Date.now();
    const cooldown = 80; // ms
    if (this.lastPlayed[event] && now - this.lastPlayed[event] < cooldown) return;
    this.lastPlayed[event] = now;

    // 2. Filter by Category Toggles
    if (event.startsWith('tap') && !state.buttonSoundsEnabled) return;
    if (event.startsWith('swipe') && !state.swipeSoundsEnabled) return;
    if (event.startsWith('char') && !state.emotionalSoundsEnabled) return;

    // 3. Handle Haptics
    if (state.hapticsEnabled) {
      this.triggerHaptic(event, customHaptic);
    }

    // 4. Handle Audio
    if (!state.soundEnabled) return;

    try {
      const theme = state.soundTheme;
      const playerKey = `${theme}_${event}`;
      let player = this.players.get(playerKey);

      if (!player) {
        const url = THEME_MAP[theme][event] || THEME_MAP['modern'][event];
        if (url) {
          player = createAudioPlayer(url);
          this.players.set(playerKey, player);
        }
      }

      if (player) {
        player.volume = state.feedbackIntensity;
        player.seekTo(0);
        player.play();
      }
    } catch (e) {
      // Fail silently for non-critical audio
    }
  }

  private triggerHaptic(event: SoundEvent, custom?: string) {
    if (custom === 'success') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (custom === 'error') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (custom === 'warning') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Contextual Defaults
    if (event === 'success' || event === 'achievement') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (event === 'error' || event === 'delete_confirmed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (event.startsWith('tap_primary')) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (event.startsWith('tap')) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (event.startsWith('swipe')) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  dispose() {
    this.players.forEach(p => p.release());
    this.players.clear();
  }
}

export const soundEngine = new SoundEngine();

