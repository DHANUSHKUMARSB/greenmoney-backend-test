import Papa from 'papaparse';

export interface ExtractedTransaction {
  amount: number;
  date: string;
  description: string;
  type: 'income' | 'expense';
}

// Using specific Wi-Fi IP because the user is testing on a physical phone via Expo Go
import { Platform } from 'react-native';
const BASE_URL            = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://greenmoney-backend-r4rq.onrender.com';

const LOCAL_BACKEND_URL   = `${BASE_URL}/extract-transactions`;
const HEALTH_URL          = `${BASE_URL}/health`;

/**
 * Quickly checks if the local backend server is reachable.
 * Resolves true if online, false if offline (timeout 4 s).
 */
export const checkServerOnline = async (): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(HEALTH_URL, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
};

/**
 * Sends extracted text to local Node.js backend for structured extraction via Ollama (phi3).
 */
export const extractTransactionsWithAI = async (text: string): Promise<ExtractedTransaction[]> => {
  try {
    console.log(`\n--- INITIATING LOCAL API REQUEST ---`);
    console.log(`Platform OS: ${Platform.OS}`);
    console.log(`Target URL: ${LOCAL_BACKEND_URL}`);
    console.log(`Payload size: ${text.length} characters`);

    const response = await fetch(LOCAL_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ text }),
    });

    console.log(`--- LOCAL API RESPONDED ---`);
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errText = await response.text();
      console.log(`Error Response Text:`, errText);
      let errMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error || errJson.details || errText;
      } catch (e) {
        // ignore
      }
      throw new Error(errMsg);
    }

    const transactions = await response.json();
    if (!Array.isArray(transactions)) {
      console.error('AI Backend did not return an array:', transactions);
      return [];
    }
    return transactions;
  } catch (error: any) {
    console.error('\n--- LOCAL AI BACKEND ERROR DETAILS ---');
    console.error('Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('Error Message:', error?.message);
    console.error('Target URL that failed:', LOCAL_BACKEND_URL);
    console.error('--------------------------------------\n');
    throw error;
  }
};

/**
 * Extracts raw text from CSV, PDF, or Image formats.
 */
export const extractTextFromFile = async (fileUri: string, mimeType: string): Promise<string> => {
  try {
    // 1. CSV Extraction
    if (mimeType.includes('csv')) {
      const response = await fetch(fileUri);
      const csvText = await response.text();
      
      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          complete: (results) => {
            // Flatten CSV rows into a readable text block for the LLM
            const text = results.data.map((row: any) => Array.isArray(row) ? row.join(', ') : '').join('\n');
            resolve(text);
          },
          error: (error: any) => reject(error)
        });
      });
    }

    // 2. & 3. PDF and Image OCR Extraction (Using free OCR API for React Native)
    // tesseract.js and pdfjs-dist require DOM/Web Workers which crash React Native Expo.
    // Instead, we pass the file to a free OCR API that handles both PDF and Images natively.
    if (mimeType.includes('pdf') || mimeType.includes('image')) {
      console.log('Sending file to OCR API...');
      
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: mimeType.includes('pdf') ? 'document.pdf' : 'image.jpg',
        type: mimeType,
      } as any);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('isTable', 'true');

      // Using OCR.space public test API for free PDF/Image text extraction
      const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'apikey': 'helloworld', // Public test key
        },
        body: formData,
      });

      const ocrData = await ocrResponse.json();
      if (ocrData.IsErroredOnProcessing) {
        const errorMsg = ocrData.ErrorMessage[0] || 'OCR Processing Failed';
        if (errorMsg.includes('maximum page limit')) {
          console.warn('OCR Warning: ' + errorMsg);
        } else {
          throw new Error(errorMsg);
        }
      }

      const extractedText = ocrData.ParsedResults?.map((res: any) => res.ParsedText).join('\n');
      return extractedText || '';
    }

    throw new Error('Unsupported file format. Please provide a CSV, PDF, or Image.');
  } catch (error) {
    console.error('File Text Extraction Error:', error);
    throw error;
  }
};

/**
 * Main service endpoint to process a file and get structured transactions.
 */
export const processFileForTransactions = async (fileUri: string, mimeType: string): Promise<ExtractedTransaction[]> => {
  try {
    console.log(`Starting text extraction for type: ${mimeType}`);
    const rawText = await extractTextFromFile(fileUri, mimeType);
    
    if (!rawText || !rawText.trim()) {
      throw new Error("No text could be extracted from the file.");
    }

    console.log(`\n--- RAW EXTRACTED TEXT (length: ${rawText.length}) ---`);
    console.log(rawText);
    console.log(`-------------------------------------\n`);

    console.log(`Sending to Local AI Backend...`);
    const transactions = await extractTransactionsWithAI(rawText);
    
    console.log(`\n--- AI PARSED TRANSACTIONS ---`);
    console.log(JSON.stringify(transactions, null, 2));
    console.log(`------------------------------\n`);

    return transactions;
  } catch (error) {
    console.error('Processing File Error:', error);
    throw error;
  }
};
