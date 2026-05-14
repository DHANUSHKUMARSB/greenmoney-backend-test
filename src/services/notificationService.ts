import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform, Linking, Alert } from "react-native";

// 1. Configure Notification Categories (Actions)
const CATEGORY_REMINDER = "daily_reminder";

export const setupNotificationCategories = async () => {
  await Notifications.setNotificationCategoryAsync(CATEGORY_REMINDER, [
    {
      identifier: "log_now",
      buttonTitle: "📝 Log Now",
      options: { opensAppToForeground: true },
    },
    {
      identifier: "snooze",
      buttonTitle: "⏰ Snooze (1hr)",
      options: { opensAppToForeground: false },
    },
  ]);
};

// 2. Global Notification Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 3. Action Listener
Notifications.addNotificationResponseReceivedListener(async (response) => {
  const { actionIdentifier, notification } = response;

  if (actionIdentifier === "snooze") {
    // Reschedule for 1 hour later
    const snoozeDate = new Date();
    snoozeDate.setHours(snoozeDate.getHours() + 1);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Snoozed Reminder",
        body: "Time to check your expenses!",
        categoryIdentifier: CATEGORY_REMINDER,
      },
      trigger: snoozeDate,
    });
  }
});

export const requestNotificationPermissions = async () => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2E7D32",
      enableVibrate: true,
      showBadge: true,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // Android 13+ Exact Alarm Permission Check - REMOVED to improve UX

  return finalStatus === "granted";
};

export const scheduleDailyReminder = async (hour: number, minute: number) => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return null;

    // Ensure categories and channels are set up
    await setupNotificationCategories();
    
    await Notifications.cancelAllScheduledNotificationsAsync();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Time to log your spending! 💰",
        body: "Don't forget to add your transactions for today to keep your budget on track.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: CATEGORY_REMINDER,
        channelId: "reminders",
      },
      trigger: {
        type: "daily",
        hour,
        minute,
      },
    });
    
    console.log(`[NOTIFICATIONS]: Daily reminder scheduled ID: ${id} at ${hour}:${minute}`);
    return id;
  } catch (error) {
    console.error("[NOTIFICATIONS]: Failed to schedule notification:", error);
    return null;
  }
};

export const scheduleTransactionReminder = async (
  title: string,
  body: string,
  date: Date,
) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      channelId: "reminders",
    },
    trigger: date,
  });
};

export const getPushToken = async () => {
  if (Platform.OS === "web") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    return null;
  }
};

export const initializeNotifications = async (
  enabled: boolean,
  time: string,
) => {
  if (!enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

  await setupNotificationCategories();
  const [hour, minute] = time.split(":").map(Number);
  await scheduleDailyReminder(hour, minute);
};
