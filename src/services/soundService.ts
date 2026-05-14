import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../store';

export type SoundEffect = 
  | 'tap' 
  | 'success' 
  | 'error' 
  | 'delete' 
  | 'sync' 
  | 'celebrate' 
  | 'toggle' 
  | 'modal_open' 
  | 'income' 
  | 'expense'
  | 'modern'
  | 'digital'
  | 'chime'
  | 'nature';

// Production sound assets hosted on reliable CDNs
const SOUND_MAP: Record<SoundEffect, string> = {
  tap: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/pop.mp3',
  success: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/success.mp3',
  error: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/error.mp3',
  delete: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/delete.mp3',
  sync: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/pop.mp3',
  celebrate: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/success.mp3',
  toggle: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/pop.mp3',
  modal_open: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/pop.mp3',
  income: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/success.mp3',
  expense: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/pop.mp3',
  modern: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/pop.mp3',
  digital: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/pop.mp3',
  chime: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/success.mp3',
  nature: 'https://raw.githubusercontent.com/the-muda-organization/muda/master/assets/sounds/pop.mp3',
};

class SoundService {
  private players: Map<SoundEffect, AudioPlayer> = new Map();
  private lastPlayed: Record<string, number> = {};

  async init() {
    try {
      const { soundEnabled } = useAppStore.getState();
      if (!soundEnabled) return;

      // Preload sounds using createAudioPlayer
      Object.keys(SOUND_MAP).forEach((key) => {
        const player = createAudioPlayer(SOUND_MAP[key as SoundEffect]);
        player.volume = 0.5;
        this.players.set(key as SoundEffect, player);
      });

      console.log('[SOUND]: Audio engine initialized (Modern expo-audio).');
    } catch (e) {
      console.warn('[SOUND]: Initialization failed', e);
    }
  }

  async play(effect: SoundEffect, hapticType?: Haptics.ImpactFeedbackStyle | 'notificationSuccess' | 'notificationError') {
    const { soundEnabled, hapticsEnabled, feedbackIntensity } = useAppStore.getState();

    // 1. Handle Haptics
    if (hapticsEnabled) {
      if (hapticType === 'notificationSuccess') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (hapticType === 'notificationError') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(hapticType || Haptics.ImpactFeedbackStyle.Light);
      }
    }

    // 2. Handle Sound
    if (!soundEnabled) return;

    // Debounce to prevent spam
    const now = Date.now();
    if (this.lastPlayed[effect] && now - this.lastPlayed[effect] < 100) return;
    this.lastPlayed[effect] = now;

    try {
      let player = this.players.get(effect);
      
      if (!player) {
        // Lazy load if not preloaded
        player = createAudioPlayer(SOUND_MAP[effect]);
        this.players.set(effect, player);
      }

      if (player) {
        player.volume = feedbackIntensity;
        // Reset to start and play
        player.seekTo(0);
        player.play();
      }
    } catch (e) {
      // Fail silently
    }
  }

  async playSuccess() { await this.play('success', 'notificationSuccess'); }
  async playError() { await this.play('error', 'notificationError'); }
  async playTap() { await this.play('tap', Haptics.ImpactFeedbackStyle.Light); }
  async playDelete() { await this.play('delete', Haptics.ImpactFeedbackStyle.Medium); }

  // Cleanup method to release players
  dispose() {
    this.players.forEach(player => player.release());
    this.players.clear();
  }
}

export const soundService = new SoundService();

