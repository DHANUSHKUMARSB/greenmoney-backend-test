import { useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { updateService, AppVersionInfo, UpdateStatus, VersionDetails } from '../services/updateService';
import { Alert, Platform } from 'react-native';

export const useForceUpdate = () => {
  const [loading, setLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>(UpdateStatus.UP_TO_DATE);
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [availableVersions, setAvailableVersions] = useState<VersionDetails[]>([]);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkVersion = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await updateService.fetchVersionInfo();
      setVersionInfo(info);
      
      const status = updateService.checkUpdateStatus(info);
      setUpdateStatus(status);

      // Extract and filter available versions
      if (info.appVersionData) {
        const { compareVersions } = require('compare-versions');
        const currentVersion = require('expo-application').nativeAppVersion || '1.0.0';
        
        const versions = Object.values(info.appVersionData)
          .filter(v => 
            compareVersions(v.version, info.minimumSupportedVersion) >= 0 && 
            compareVersions(v.version, currentVersion) > 0
          )
          .sort((a, b) => compareVersions(b.version, a.version)); // Newest first
          
        setAvailableVersions(versions);
      }
    } catch (err: any) {
      console.error('[useForceUpdate] Error checking version:', err);
      setError('Unable to check for updates. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkVersion();
  }, []);

  const downloadAndInstall = async (versionToInstall?: VersionDetails) => {
    const target = versionToInstall || (versionInfo?.appVersionData[versionInfo.latestVersion]);
    
    if (!target?.apkUrl) {
      Alert.alert('Error', 'Invalid APK URL');
      return;
    }

    if (Platform.OS !== 'android') {
      Alert.alert('Notice', 'Direct APK updates are only available on Android.');
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      const filename = `greenmoney_${target.version}.apk`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        target.apkUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      const downloadResult = await downloadResumable.downloadAsync();

      if (downloadResult && downloadResult.uri) {
        setIsDownloading(false);
        // Request installation
        installApk(downloadResult.uri);
      }
    } catch (err: any) {
      console.error('[useForceUpdate] Download error:', err);
      setIsDownloading(false);
      Alert.alert('Download Failed', 'Failed to download the update. Please try again.');
    }
  };

  const installApk = async (uri: string) => {
    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
    } catch (err) {
      console.error('[useForceUpdate] Install error:', err);
      Alert.alert('Installation Failed', 'Could not launch the installer.');
    }
  };

  return {
    loading,
    updateStatus,
    versionInfo,
    availableVersions,
    downloadProgress,
    isDownloading,
    error,
    checkVersion,
    downloadAndInstall,
  };
};
