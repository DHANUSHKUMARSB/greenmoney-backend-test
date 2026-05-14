import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Modal, 
  ActivityIndicator,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { UpdateStatus, VersionDetails } from '../services/updateService';
import { useForceUpdate } from '../hooks/useForceUpdate';
import { ScrollView as RNScrollView } from 'react-native';

const { width, height } = Dimensions.get('window');

interface ForceUpdateScreenProps {
  isVisible?: boolean;
}

export const ForceUpdateScreen: React.FC<ForceUpdateScreenProps> = ({ isVisible = true }) => {
  const [isDismissed, setIsDismissed] = React.useState(false);
  const { 
    loading, 
    updateStatus, 
    versionInfo, 
    availableVersions,
    downloadProgress, 
    isDownloading, 
    error,
    checkVersion,
    downloadAndInstall 
  } = useForceUpdate();

  const [showVersionList, setShowVersionList] = React.useState(false);
  const [selectedVersion, setSelectedVersion] = React.useState<VersionDetails | null>(null);

  React.useEffect(() => {
    if (versionInfo && updateStatus === UpdateStatus.OPTIONAL_UPDATE) {
      AsyncStorage.getItem('dismissed_version').then(val => {
        if (val === versionInfo.latestVersion) {
          setIsDismissed(true);
        }
      });
    }
  }, [versionInfo, updateStatus]);

  const handleDismiss = async () => {
    if (versionInfo) {
      await AsyncStorage.setItem('dismissed_version', versionInfo.latestVersion);
      setIsDismissed(true);
    }
  };

  if (loading && !versionInfo) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Checking for updates...</Text>
      </View>
    );
  }

  const isForce = updateStatus === UpdateStatus.FORCE_UPDATE;

  if ((updateStatus === UpdateStatus.UP_TO_DATE && !error) || (isDismissed && !isForce)) {
    return null;
  }

  return (
    <Modal
      visible={isVisible && (updateStatus !== UpdateStatus.UP_TO_DATE || !!error)}
      animationType="fade"
      transparent={true}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons 
              name={error ? "alert-circle" : "update"} 
              size={80} 
              color="#FFFFFF" 
            />
          </View>

          {showVersionList && !isDownloading ? (
            <View style={styles.versionListContainer}>
              <Text style={styles.listTitle}>Select Version to Install</Text>
              <RNScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                {availableVersions.map((v) => (
                  <TouchableOpacity 
                    key={v.version} 
                    style={styles.versionItem}
                    onPress={() => {
                      setSelectedVersion(v);
                      downloadAndInstall(v);
                    }}
                  >
                    <View style={styles.versionItemHeader}>
                      <Text style={styles.itemVersionText}>v{v.version}</Text>
                      {v.version === versionInfo?.latestVersion && (
                        <View style={styles.latestBadge}>
                          <Text style={styles.latestBadgeText}>LATEST</Text>
                        </View>
                      )}
                    </View>
                    {v.releaseNotes.map((note, i) => (
                      <Text key={i} style={styles.itemNoteText}>• {note}</Text>
                    ))}
                  </TouchableOpacity>
                ))}
              </RNScrollView>
              <TouchableOpacity style={styles.backButton} onPress={() => setShowVersionList(false)}>
                <Text style={styles.backButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.title}>
                {error ? "Connection Error" : isForce ? "Update Required" : "New Update Available"}
              </Text>
              
              <Text style={styles.versionText}>
                {versionInfo ? `Latest: v${versionInfo.latestVersion}` : ""}
              </Text>

              <Text style={styles.description}>
                {error 
                  ? error 
                  : isForce 
                    ? "This version of GreenMoney is no longer supported. Please update to continue using the app."
                    : "New versions of GreenMoney are available with exciting features."}
              </Text>

              {isDownloading ? (
                <View style={styles.progressContainer}>
                  <Text style={styles.downloadingVersionText}>Updating to v{selectedVersion?.version || versionInfo?.latestVersion}</Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${downloadProgress * 100}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
                  <Text style={styles.statusSubText}>Downloading update package...</Text>
                </View>
              ) : (
                <View style={styles.buttonContainer}>
                  <TouchableOpacity 
                    style={styles.primaryButton}
                    onPress={() => {
                      if (error) checkVersion();
                      else if (availableVersions.length > 1) setShowVersionList(true);
                      else downloadAndInstall(availableVersions[0]);
                    }}
                  >
                    <Text style={styles.primaryButtonText}>
                      {error ? "Retry" : availableVersions.length > 1 ? "Select Version" : "Update Now"}
                    </Text>
                  </TouchableOpacity>

                  {!isForce && !error && (
                    <TouchableOpacity style={styles.secondaryButton} onPress={handleDismiss}>
                      <Text style={styles.secondaryButtonText}>Later</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 20,
    fontSize: 16,
    opacity: 0.8,
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  notesContainer: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noteItem: {
    fontSize: 14,
    color: '#BBBBBB',
    marginBottom: 4,
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    height: 60,
    backgroundColor: '#4CAF50',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#888888',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statusSubText: {
    fontSize: 14,
    color: '#888888',
  },
  versionListContainer: {
    width: '100%',
    maxHeight: height * 0.7,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  listScroll: {
    marginBottom: 20,
  },
  versionItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  versionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemVersionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  latestBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  latestBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4CAF50',
  },
  itemNoteText: {
    fontSize: 13,
    color: '#BBBBBB',
    lineHeight: 18,
    marginTop: 2,
  },
  backButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#888888',
    fontWeight: '600',
  },
  downloadingVersionText: {
    color: '#4CAF50',
    fontWeight: '700',
    marginBottom: 16,
    fontSize: 16,
  }
});
