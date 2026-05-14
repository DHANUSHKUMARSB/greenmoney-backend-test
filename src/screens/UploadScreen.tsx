import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from "expo-document-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useTheme } from "../hooks/useTheme";
import {
  checkServerOnline,
  processFileForTransactions,
} from "../services/aiService";
import { uploadFile } from "../services/storageService";
import { spacing, typography } from "../utils/theme";

// ─── Processing Steps ────────────────────────────────────────────────────────
const STEPS = [
  { key: "saving", icon: "save-outline", label: "Saving file locally..." },
  { key: "ocr", icon: "scan-outline", label: "Extracting text via OCR..." },
  {
    key: "ai",
    icon: "hardware-chip-outline",
    label: "AI is reading transactions...",
  },
  {
    key: "done",
    icon: "checkmark-circle",
    label: "Done! Preparing preview...",
  },
];

// ─── Spinning loader dot ──────────────────────────────────────────────────────
const SpinnerDot = ({ color }: { color: string }) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }], marginRight: 12 }}>
      <Ionicons name="refresh-outline" size={22} color={color} />
    </Animated.View>
  );
};

// ─── Processing Overlay ───────────────────────────────────────────────────────
const ProcessingOverlay = ({
  visible,
  currentStep,
  colors,
}: {
  visible: boolean;
  currentStep: string;
  colors: any;
}) => {
  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={overlayStyles.backdrop}>
        <View style={[overlayStyles.card, { backgroundColor: colors.card }]}>
          <Text style={[overlayStyles.title, { color: colors.text }]}>
            Processing File
          </Text>
          <Text
            style={[overlayStyles.subtitle, { color: colors.textSecondary }]}
          >
            Please wait, this may take a moment...
          </Text>

          <View style={{ marginTop: spacing.l }}>
            {STEPS.map((step, index) => {
              const isActive = index === stepIndex;
              const isDone = index < stepIndex || currentStep === "done";
              const isPending = index > stepIndex;

              return (
                <View key={step.key} style={overlayStyles.stepRow}>
                  {/* Left indicator */}
                  <View style={{ width: 32, alignItems: "center" }}>
                    {isDone ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#4CAF50"
                      />
                    ) : isActive ? (
                      <SpinnerDot color={colors.primary} />
                    ) : (
                      <Ionicons
                        name={step.icon as any}
                        size={22}
                        color={colors.textSecondary}
                      />
                    )}
                  </View>

                  {/* Label */}
                  <Text
                    style={[
                      overlayStyles.stepLabel,
                      {
                        color: isDone
                          ? "#4CAF50"
                          : isActive
                            ? colors.primary
                            : colors.textSecondary,
                        fontWeight: isActive ? "700" : "400",
                      },
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const UploadScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [selectedFile, setSelectedFile] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState("saving");
  const [serverOnline, setServerOnline] = useState<boolean | null>(null); // null = checking

  // ── Check server health on mount ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const online = await checkServerOnline();
      if (!cancelled) setServerOnline(online);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*", "text/csv"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setSelectedFile(result.assets[0]);
        setUploadedUrl(null);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // ── Guard: check server before starting ─────────────────────────────────
    const online = await checkServerOnline();
    if (!online) {
      Alert.alert(
        "⚠️ Server Unavailable",
        "The upload feature is currently not available because the processing server is shut down.\n\nServer Will be back soon and try again later.",
        [{ text: "OK", style: "default" }],
      );
      return;
    }

    setIsUploading(true);
    setCurrentStep("saving");

    try {
      // Step 1 — Save locally
      const url = await uploadFile(
        selectedFile.uri,
        selectedFile.name,
        selectedFile.mimeType || "application/octet-stream",
      );
      setUploadedUrl(url);

      // Step 2 — OCR
      setCurrentStep("ocr");
      // Small artificial pause so user sees the OCR step text before AI starts
      await new Promise((r) => setTimeout(r, 400));

      // Step 3 — AI (the real work happens here)
      setCurrentStep("ai");
      const transactions = await processFileForTransactions(
        url,
        selectedFile.mimeType || "application/octet-stream",
      );

      // Step 4 — Done
      setCurrentStep("done");
      await new Promise((r) => setTimeout(r, 600));

      setIsUploading(false);
      navigation.navigate("AIPreview", { transactions });
    } catch (error: any) {
      setIsUploading(false);
      Alert.alert("Upload Failed", error.message || "Something went wrong.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}>
      {/* Processing overlay */}
      <ProcessingOverlay
        visible={isUploading}
        currentStep={currentStep}
        colors={colors}
      />

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.header, { color: colors.text }]}>Upload File</Text>
        {/* Re-check server button */}
        <TouchableOpacity
          onPress={async () => {
            setServerOnline(null);
            setServerOnline(await checkServerOnline());
          }}
          style={{ padding: spacing.xs }}
        >
          <Ionicons
            name="refresh-outline"
            size={22}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Server status banner ──────────────────────────────────── */}
      {serverOnline === null && (
        <View style={[styles.banner, { backgroundColor: colors.card }]}>
          <Ionicons
            name="radio-button-on-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
            Checking server status...
          </Text>
        </View>
      )}
      {serverOnline === false && (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: "#FFF3F3",
              borderColor: "#F44336",
              borderWidth: 1,
            },
          ]}
        >
          <Ionicons name="cloud-offline-outline" size={18} color="#F44336" />
          <View style={{ flex: 1, marginLeft: spacing.s }}>
            <Text style={[styles.bannerTitle, { color: "#F44336" }]}>
              Server Offline
            </Text>
            <Text style={[styles.bannerText, { color: "#F44336" }]}>
              Upload feature unavailable. Start the backend server and tap ↻ to
              retry.
            </Text>
          </View>
        </View>
      )}
      {serverOnline === true && (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: "#F0FFF4",
              borderColor: "#4CAF50",
              borderWidth: 1,
            },
          ]}
        >
          <Ionicons name="cloud-done-outline" size={18} color="#4CAF50" />
          <Text
            style={[
              styles.bannerText,
              { color: "#4CAF50", marginLeft: spacing.s },
            ]}
          >
            Server online — ready to process
          </Text>
        </View>
      )}

      {/* Drop zone */}
      <Card style={styles.uploadCard}>
        <TouchableOpacity
          style={[
            styles.selectArea,
            selectedFile && { opacity: 0.5, borderColor: colors.textSecondary + '44', backgroundColor: 'transparent' }
          ]}
          onPress={() => {
            if (selectedFile) {
              Alert.alert(
                'Only one file allowed',
                'Only one file is allowed to upload at once. Please remove the current file to select a new one.'
              );
            } else {
              handleSelectFile();
            }
          }}
          disabled={isUploading}
        >
          <Ionicons
            name={selectedFile ? "lock-closed-outline" : "cloud-upload-outline"}
            size={48}
            color={selectedFile ? colors.textSecondary : colors.primary}
          />
          <Text style={[styles.selectText, { color: selectedFile ? colors.textSecondary : colors.primary }]}>
            {selectedFile ? 'Remove current file to change' : 'Tap to select CSV, PDF, or Image'}
          </Text>
        </TouchableOpacity>

        {selectedFile && (
          <View style={styles.fileInfo}>
            <Ionicons name="document-text" size={24} color={colors.text} />
            <Text
              style={[styles.fileName, { color: colors.text }]}
              numberOfLines={1}
            >
              {selectedFile.name}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedFile(null)}
              disabled={isUploading}
            >
              <Ionicons name="close-circle" size={24} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {/* Upload button */}
      {selectedFile && !isUploading && (
        <Button
          title={serverOnline === false ? 'Server Offline — Unavailable' : 'Analyse & Extract'}
          onPress={handleUpload}
          style={[styles.uploadBtn, { opacity: serverOnline ? 1 : 0.45 }]}
          disabled={!serverOnline}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.m },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.m,
    marginTop: spacing.s,
  },
  backButton: { padding: spacing.xs },
  header: { ...typography.header },
  description: {
    ...typography.body,
    marginBottom: spacing.l,
    textAlign: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: spacing.m,
    marginBottom: spacing.m,
  },
  bannerTitle: { fontWeight: "700", fontSize: 14, marginBottom: 2 },
  bannerText: { fontSize: 13 },
  uploadCard: { padding: spacing.m, marginBottom: spacing.l },
  selectArea: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#4CAF50",
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(76, 175, 80, 0.05)",
  },
  selectText: { ...typography.title, marginTop: spacing.s, fontWeight: "bold" },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.m,
    padding: spacing.s,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 8,
  },
  fileName: {
    flex: 1,
    marginLeft: spacing.s,
    marginRight: spacing.s,
    ...typography.body,
  },
  uploadBtn: { marginTop: spacing.s },
});

const overlayStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "85%",
    borderRadius: 20,
    padding: spacing.xl,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: { ...typography.header, textAlign: "center" },
  subtitle: { ...typography.body, textAlign: "center", marginTop: spacing.xs },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.m,
  },
  stepLabel: { ...typography.body, flex: 1 },
});
