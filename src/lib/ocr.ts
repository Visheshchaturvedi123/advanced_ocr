import { createWorker, OEM } from 'tesseract.js';

export type OcrLanguage = 'eng' | 'hin';

export interface OcrProgress {
  status: string;
  progress: number;
}

const assetUrl = (path: string) => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
    throw new Error('OCR works only inside the Brahma extension.');
  }
  return chrome.runtime.getURL(path);
};

export const recognizeImage = async (
  image: string,
  language: OcrLanguage = 'eng',
  onProgress?: (progress: OcrProgress) => void
): Promise<string> => {
  const worker = await createWorker(language, OEM.LSTM_ONLY, {
    workerPath: assetUrl('ocr/worker.min.js'),
    corePath: assetUrl('ocr'),
    langPath: assetUrl('ocr/lang'),
    workerBlobURL: false,
    gzip: true,
    logger: (message) => {
      onProgress?.({
        status: message.status || 'working',
        progress: typeof message.progress === 'number' ? message.progress : 0,
      });
    },
  });

  try {
    const result = await worker.recognize(image);
    return (result.data.text || '').trim();
  } finally {
    await worker.terminate();
  }
};
