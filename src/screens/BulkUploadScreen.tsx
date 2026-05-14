import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useTheme } from "../hooks/useTheme";
import * as Clipboard from "expo-clipboard";
import { getCategories } from "../services/database";

const getExtractionPrompt = (expenseCats: string[], incomeCats: string[]) => `
You are a finance transaction extraction engine.

Your task is to analyze ANY finance-related document such as:
- Bank statements
- Passbooks
- Expense sheets
- Bills & invoices
- Receipts
- PDFs
- Excel sheets
- Screenshots
- Scanned images
- OCR text
- UPI transaction history
- Credit/Debit card statements

YOUR RESPONSE FORMAT IS STRICT.

The final output MUST contain ONLY:

1. A single line of text exactly as below:
Copy the below json data and paste it in the green money app or press the paste button in the green money app to import the transactions

2. Below that, a markdown code block containing ONLY the JSON array.

EXAMPLE OUTPUT FORMAT:

Copy the below json data and paste it in the green money app or press the paste button in the green money app to import the transactions

\`\`\`json
[
  {
    "amount": 350,
    "date": "2026-01-29",
    "description": "K Deepa",
    "category": "${expenseCats[0] || "food"}",
    "type": "expense",
    "payment_mode": "UPI"
  }
]
\`\`\`

STRICT RULES:
- Do NOT add explanations.
- Do NOT add markdown headings.
- Do NOT add notes.
- Do NOT add summaries.
- Do NOT add extra text before or after.
- The JSON must always be inside a markdown code block.
- The code block must contain ONLY valid JSON.

JSON FORMAT:
[
  {
    "amount": number,
    "date": "YYYY-MM-DD",
    "description": "string",
    "category": "string",
    "type": "income" | "expense" | "transfer",
    "payment_mode": "string"
  }
]

DESCRIPTION CLEANING RULES:
Convert raw narration into short meaningful text.
Remove: UPI, IMPS, NEFT, RTGS, credited, debited, txn, transfer, payment.
Remove phone numbers/account numbers/reference IDs.

CATEGORY RULES:

Allowed expense categories ONLY:
${expenseCats.map((c) => `- "${c}"`).join("\n")}

Allowed income categories ONLY:
${incomeCats.map((c) => `- "${c}"`).join("\n")}

TRANSFER RULE:
- Personal transfers/self transfers/friend transfers:
  - type = "transfer"
  - category = "null"

CATEGORY CLASSIFICATION:
If the transaction doesn't perfectly fit, choose the closest match from the lists above.
${expenseCats.includes("food") ? '- Restaurants, tea shops, fruits, Swiggy, Zomato → "food"' : ""}
${expenseCats.includes("transport") ? '- Uber, Ola, fuel, bus, metro → "transport"' : ""}
${expenseCats.includes("bills") ? '- Recharge, EB, electricity, gas, internet → "bills"' : ""}
${expenseCats.includes("entertainment") ? '- Netflix, movies, games, Spotify → "entertainment"' : ""}
${expenseCats.includes("health") ? '- Pharmacy, clinic, hospital → "health"' : ""}
${expenseCats.includes("shopping") ? '- Amazon, Flipkart, supermarket, clothes → "shopping"' : ""}
${incomeCats.includes("salary") ? '- Employer/company credit → "salary"' : ""}
${incomeCats.includes("gig works") ? '- Freelance/project income → "gig works"' : ""}
${incomeCats.includes("cashbacks") ? '- Reward/cashback → "cashbacks"' : ""}
${incomeCats.includes("owe") ? '- Returned money from friend → "owe"' : ""}

TYPE DETECTION:
- Incoming salary/business payment → "income"
- Money spent → "expense"
- Personal transfer → "transfer"

PAYMENT MODE NORMALIZATION:
Use standardized values: "UPI", "NEFT", "IMPS", "RTGS", "Cash", "Card", "Bank Transfer", "Cheque", "ATM".

FINAL RULE:
The response MUST contain ONLY:
1. The exact instruction sentence.
2. One JSON markdown code block.
Nothing else.
`;

export const BulkUploadScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [jsonInput, setJsonInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [categories, setCategories] = useState<{
    expense: string[];
    income: string[];
  }>({
    expense: ["food", "transport", "bills", "shopping", "health"],
    income: ["salary", "gig works"],
  });

  React.useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const allCats = await getCategories();
      setCategories({
        expense: allCats
          .filter((c) => c.type === "expense")
          .map((c) => c.name.toLowerCase()),
        income: allCats
          .filter((c) => c.type === "income")
          .map((c) => c.name.toLowerCase()),
      });
    } catch (error) {
      console.error("Failed to load categories for AI prompt", error);
    }
  };

  const openChatGPT = async () => {
    const prompt = getExtractionPrompt(categories.expense, categories.income);

    const appUrl = `chatgpt://chat?temporary-chat=true&q=${encodeURIComponent(
      prompt,
    )}`;

    const webUrl = `https://chatgpt.com/?temporary-chat=true&q=${encodeURIComponent(
      prompt,
    )}`;

    try {
      const supported = await Linking.canOpenURL(appUrl);

      if (supported) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      Alert.alert(
        "Error",
        "Could not open ChatGPT. Please ensure you have it installed or use the web version.",
      );
    }
  };

  const handleValidate = async (customInput?: string) => {
    const inputToValidate = customInput || jsonInput;
    if (!inputToValidate.trim()) {
      Alert.alert("Error", "Please paste the JSON data from ChatGPT.");
      return;
    }

    setIsValidating(true);
    try {
      // Find JSON block if present
      let cleanedInput = inputToValidate;
      const jsonMatch = inputToValidate.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        cleanedInput = jsonMatch[0];
      }

      const parsed = JSON.parse(cleanedInput);
      if (!Array.isArray(parsed)) {
        throw new Error("Data is not an array of transactions.");
      }

      // Basic structure validation
      parsed.forEach((tx, index) => {
        if (!tx.amount || !tx.date || !tx.description || !tx.type) {
          throw new Error(
            `Transaction at index ${index} is missing required fields.`,
          );
        }
      });

      navigation.navigate("DuplicateDetection", { transactions: parsed });
    } catch (error: any) {
      Alert.alert(
        "Validation Error",
        "The JSON data format is wrong please try regenerating the JSON in LLM or press the open ChatGPT button again."
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handlePasteAndImport = async () => {
    const content = await Clipboard.getStringAsync();
    if (!content.trim()) {
      Alert.alert(
        "No Data Found",
        "Please copy the JSON data from the LLM or enter the JSON data manually."
      );
      return;
    }
    setJsonInput(content);
    // Directly validate and move to next screen
    handleValidate(content);
  };

  const handleClear = () => {
    setJsonInput("");
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing.m,
        },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          AI Bulk Import
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.instructionCard}>
          <View style={styles.stepRow}>
            <View
              style={[styles.stepNumber, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.stepText}>1</Text>
            </View>
            <View style={styles.stepInfo}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Open ChatGPT
              </Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                We'll open ChatGPT with a special command to read your
                documents.
              </Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View
              style={[styles.stepNumber, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.stepText}>2</Text>
            </View>
            <View style={styles.stepInfo}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Upload & Copy
              </Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                Upload your statement/screenshot and copy the JSON it generates.
              </Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View
              style={[styles.stepNumber, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.stepText}>3</Text>
            </View>
            <View style={styles.stepInfo}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Paste & Import
              </Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                Paste the results below to review and save your transactions.
              </Text>
            </View>
          </View>

          <Button
            title="Open ChatGPT"
            onPress={openChatGPT}
            icon={<Ionicons name="logo-chatgpt" size={20} color="#fff" />}
            style={styles.chatBtn}
          />
        </Card>

        <View style={styles.inputSection}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.text }]}>
              Paste JSON Results
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={handleClear}
                style={[
                  styles.pasteBtn,
                  { backgroundColor: colors.error + "15" },
                ]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={[styles.pasteBtnText, { color: colors.error }]}>
                  Clear
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePasteAndImport}
                style={[
                  styles.pasteBtn,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <Ionicons
                  name="clipboard-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.pasteBtnText, { color: colors.primary }]}>
                  Paste
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={[
              styles.jsonInput,
              {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            multiline
            placeholder="Paste the JSON block here..."
            placeholderTextColor={colors.textSecondary + "66"}
            value={jsonInput}
            onChangeText={setJsonInput}
            textAlignVertical="top"
          />
        </View>

        <Button
          title="Analyze Transactions"
          onPress={() => handleValidate()}
          loading={isValidating}
          style={styles.validateBtn}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: { padding: 8, marginRight: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  scrollContent: { padding: 20 },
  instructionCard: { padding: 20, marginBottom: 24 },
  stepRow: { flexDirection: "row", marginBottom: 20 },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  stepText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  stepInfo: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  stepDesc: { fontSize: 14, lineHeight: 20 },
  chatBtn: { marginTop: 12 },
  inputSection: { marginBottom: 24 },
  label: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  jsonInput: {
    height: 200,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: "monospace",
  },
  validateBtn: { marginBottom: 40 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  pasteBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
});
