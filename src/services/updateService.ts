import axios from 'axios';
import * as Application from 'expo-application';
import { compareVersions } from 'compare-versions';

const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export interface VersionDetails {
  version: string;
  apkUrl: string;
  releaseNotes: string[];
}

export interface AppVersionInfo {
  latestVersion: string;
  appVersionData: Record<string, VersionDetails>;
  minimumSupportedVersion: string;
  forceUpdate: boolean;
  updatedAt?: string;
}

export enum UpdateStatus {
  UP_TO_DATE = 'UP_TO_DATE',
  OPTIONAL_UPDATE = 'OPTIONAL_UPDATE',
  FORCE_UPDATE = 'FORCE_UPDATE',
}

export const updateService = {
  /**
   * Transforms sharing URLs (like Google Drive) into direct download links.
   */
  sanitizeUrl: (url: string): string => {
    if (!url) return '';
    // Google Drive direct link transformation
    if (url.includes('drive.google.com') && url.includes('/file/d/')) {
      const match = url.match(/\/file\/d\/([^/]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }
    return url;
  },

  /**
   * Fetches the latest app version info from the backend.
   */
  fetchVersionInfo: async (): Promise<AppVersionInfo> => {
    try {
      console.log(`[UpdateService] Fetching from: ${API_URL}/app-version`);
      const response = await axios.get(`${API_URL}/app-version`, { 
        timeout: 10000, // 10s timeout
        headers: { 'Cache-Control': 'no-cache' } 
      });
      
      const data = response.data as AppVersionInfo;
      
      // Sanitize all APK URLs in the version data
      if (data.appVersionData) {
        Object.keys(data.appVersionData).forEach(key => {
          data.appVersionData[key].apkUrl = updateService.sanitizeUrl(data.appVersionData[key].apkUrl);
        });
      }
      
      return data;
    } catch (error: any) {
      console.error('[UpdateService] Failed to fetch version info:', error.message, error.config?.url);
      throw error;
    }
  },


  /**
   * Compares the current app version with the backend version info.
   */
  checkUpdateStatus: (info: AppVersionInfo): UpdateStatus => {
    const currentVersion = Application.nativeAppVersion || '1.0.0';
    
    console.log(`[UpdateService] Current: ${currentVersion}, Latest: ${info.latestVersion}, Min: ${info.minimumSupportedVersion}`);

    // Check if version is below minimum supported
    if (compareVersions(currentVersion, info.minimumSupportedVersion) < 0) {
      return UpdateStatus.FORCE_UPDATE;
    }

    // Check if version is below latest
    if (compareVersions(currentVersion, info.latestVersion) < 0) {
      // If forceUpdate flag is explicitly true, treat it as a force update
      return info.forceUpdate ? UpdateStatus.FORCE_UPDATE : UpdateStatus.OPTIONAL_UPDATE;
    }

    return UpdateStatus.UP_TO_DATE;
  }
};
