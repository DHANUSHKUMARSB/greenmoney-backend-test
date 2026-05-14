import * as FileSystem from 'expo-file-system/legacy';

export const uploadFile = async (fileUri: string, fileName: string, mimeType: string): Promise<string> => {
  try {
    const uniqueFileName = `${Date.now()}_${fileName.replace(/\s+/g, '_')}`;
    // Using the documentDirectory which is a standard local storage path for the app
    const destinationUri = `${FileSystem.documentDirectory}${uniqueFileName}`;

    // Copy the file from the cache (where DocumentPicker puts it) to permanent app storage
    await FileSystem.copyAsync({
      from: fileUri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    console.error("Local storage save error:", error);
    throw new Error("Failed to save file locally on device.");
  }
};
