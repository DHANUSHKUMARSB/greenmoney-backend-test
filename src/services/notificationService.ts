import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermissions = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
};

export const scheduleDailyReminder = async (hour: number, minute: number) => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💰 Time to log your spending!",
        body: "Don't forget to add your transactions for today to keep your budget on track.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        channelId: 'default',
      },
      trigger: {
        hour,
        minute,
        repeats: true,
        channelId: 'default',
      },
    });
    console.log(`Notification scheduled: ${id} at ${hour}:${minute}`);
    return id;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    return null;
  }
};

export const scheduleTransactionReminder = async (title: string, body: string, date: Date) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
    },
    trigger: date,
  });
};

export const getPushToken = async () => {
  if (Platform.OS === 'web') return null;
  
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('Push: No Project ID found in app.json');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Push: Failed to get push token for push notification!');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('Push: Expo Push Token:', token.data);
    return token.data;
  } catch (error) {
    console.error('Push: Error getting push token:', error);
    return null;
  }
};
