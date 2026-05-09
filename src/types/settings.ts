export interface UserSettings {
  // Appearance
  theme: 'system' | 'light' | 'dark';
  accent_color: string;
  
  // Localization
  currency: string;
  language: string;
  
  // Notifications
  notification_enabled: boolean;
  notification_sound: string;
  reminder_settings: {
    enabled: boolean;
    time: string; // HH:mm
  };
  
  // Preferences
  backup_preferences: {
    auto_sync: boolean;
    sync_on_wifi_only: boolean;
  };
  premium_preferences: {
    hide_ads: boolean;
  };
  privacy_settings: {
    hide_balance: boolean;
  };
  
  // Metadata
  version: number;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  profile: {
    username: string | null;
    email: string | null;
    avatar: string | null;
  };
  settings: UserSettings;
  sync_metadata: {
    last_sync_at: string;
    updated_at: string;
    version: number;
  };
}
