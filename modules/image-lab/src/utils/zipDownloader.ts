/**
 * Ultra-robust ZIP Downloader for the Local Image Optimizer.
 *
 * Resolves the damaged/corrupt ZIP issue in iframe/preview environments:
 * 1. Uses fetch() inside the iframe security context so session credentials & cookies are preserved.
 * 2. Intercepts and detects any iframe Cookie-Check HTML gateways or 404/500 JSON errors.
 * 3. Validates binary ZIP headers (magic bytes 0x50, 0x4B) before any file is saved.
 * 4. Creates an in-memory Blob URL to trigger browser download without network redirect.
 * 5. Emits real-time download status events for the UI.
 */

import { hubFetch } from './hubApi';

export interface ZipDownloadStatus {
  state: 'idle' | 'downloading' | 'verifying' | 'success' | 'error';
  message: string;
  bytes?: number;
  filename?: string;
}

type StatusListener = (status: ZipDownloadStatus) => void;
const listeners = new Set<StatusListener>();

export function onZipDownloadStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(status: ZipDownloadStatus) {
  for (const l of listeners) {
    try {
      l(status);
    } catch {}
  }
}

/**
 * Downloads the optimized WebP images as a verified ZIP file.
 * Returns true if the download succeeded, false otherwise.
 */
export async function downloadOptimizedZip(jobId?: string, folder?: string): Promise<boolean> {
  const defaultFilename = jobId
    ? `optimized_webp_${jobId}.zip`
    : `optimized_webp_collection_${Date.now()}.zip`;

  const url = jobId
    ? `/api/optimize/download-zip/${encodeURIComponent(jobId)}`
    : `/api/optimize/download-zip-current?folder=${encodeURIComponent(folder || './optimized_webp')}`;

  notify({
    state: 'downloading',
    message: 'Streaming & compressing optimized WebP images...',
    filename: defaultFilename,
  });

  try {
    const response = await hubFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/zip, application/octet-stream, */*',
      },
    });

    if (!response.ok) {
      let errorMessage = `Server error ${response.status} (${response.statusText})`;
      try {
        const errJson = await response.json();
        if (errJson.error) errorMessage = errJson.error;
      } catch {
        const errText = await response.text();
        if (errText) errorMessage = errText.slice(0, 150);
      }
      throw new Error(errorMessage);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    // Check if the response was intercepted by an auth challenge or HTML gateway
    if (contentType.includes('text/html')) {
      throw new Error(
        'Download request was intercepted by browser security cookie check. Please open the app directly in a full browser tab to download.'
      );
    }

    if (contentType.includes('application/json')) {
      const json = await response.json();
      throw new Error(json.error || 'Server returned an error instead of a ZIP file');
    }

    notify({
      state: 'verifying',
      message: 'Validating ZIP archive integrity and file signatures...',
      filename: defaultFilename,
    });

    // Read full arrayBuffer into memory
    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength < 22) {
      throw new Error(
        'Received empty or incomplete archive (less than 22 bytes). Ensure optimization has finished producing files.'
      );
    }

    // Verify standard ZIP magic byte signature: 0x50 0x4B (ASCII "PK")
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    if (header[0] !== 0x50 || header[1] !== 0x4b) {
      // Decode beginning of data to see what was actually returned
      const textSample = new TextDecoder().decode(arrayBuffer.slice(0, 100));
      console.error('Invalid ZIP header received:', textSample);
      throw new Error(
        'Downloaded file is not a valid ZIP archive. The server returned unexpected non-ZIP data.'
      );
    }

    // Determine clean filename from Content-Disposition header if available
    let finalFilename = defaultFilename;
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const matchUtf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (matchUtf8 && matchUtf8[1]) {
        try {
          finalFilename = decodeURIComponent(matchUtf8[1]);
        } catch {}
      } else {
        const matchStandard = disposition.match(/filename="?([^";]+)"?/i);
        if (matchStandard && matchStandard[1]) {
          finalFilename = matchStandard[1];
        }
      }
    }

    // Create memory Blob and trigger clean browser download
    const blob = new Blob([arrayBuffer], { type: 'application/zip' });
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = finalFilename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke memory URL after 30 seconds
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 30000);

    notify({
      state: 'success',
      message: `ZIP archive downloaded successfully (${formatBytes(arrayBuffer.byteLength)})`,
      bytes: arrayBuffer.byteLength,
      filename: finalFilename,
    });

    return true;
  } catch (err: any) {
    console.error('ZIP Download failed:', err);
    notify({
      state: 'error',
      message: err.message || 'Failed to download ZIP file',
      filename: defaultFilename,
    });
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}
