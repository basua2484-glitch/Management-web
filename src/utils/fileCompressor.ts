import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB: number; // Max target size in MB (e.g. 0.3 for ~300KB)
  maxWidthOrHeight: number; // Maintain readable text resolution for Aadhaar/PAN
  useWebWorker: boolean;
  fileType?: string;
  initialQuality?: number;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savedPercentage: number;
  isCompressed: boolean;
  originalFormatted: string;
  compressedFormatted: string;
}

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxSizeMB: 0.3, // Max target size ~300KB
  maxWidthOrHeight: 1200, // Maintain readable text resolution for Aadhaar/PAN
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.85,
};

/**
 * Format bytes to readable size string (KB / MB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Fallback compressor using HTML Canvas API if web worker or browser-image-compression fails
 */
async function compressViaCanvas(file: File, options: CompressionOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);

    img.onload = () => {
      let { width, height } = img;
      const maxDim = options.maxWidthOrHeight;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas 2D context'));
        return;
      }

      // Draw with high quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob returned null'));
          }
        },
        options.fileType || 'image/jpeg',
        0.82
      );
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compression Interceptor Utility:
 * - Compresses images (JPEG, PNG, WEBP, BMP) using browser-image-compression (or Canvas fallback)
 * - Restricts max size to ~300KB while maintaining 1200px resolution for Aadhaar/PAN readability
 * - Returns original PDF files directly or validates PDF max size
 */
export const compressDocument = async (
  file: File,
  customOptions?: Partial<CompressionOptions>
): Promise<File> => {
  const options = { ...DEFAULT_COMPRESSION_OPTIONS, ...customOptions };

  if (file.type.startsWith('image/')) {
    try {
      const compressedBlob = await imageCompression(file, options);
      const targetFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
      return new File([compressedBlob], targetFileName, {
        type: options.fileType || 'image/jpeg',
        lastModified: Date.now(),
      });
    } catch (error) {
      console.warn('browser-image-compression error, attempting Canvas fallback:', error);
      try {
        const canvasBlob = await compressViaCanvas(file, options);
        const targetFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
        return new File([canvasBlob], targetFileName, {
          type: options.fileType || 'image/jpeg',
          lastModified: Date.now(),
        });
      } catch (canvasError) {
        console.error('All compression attempts failed, falling back to original:', canvasError);
        return file;
      }
    }
  }

  // Return PDF or other doc types as-is
  return file;
};

/**
 * Full details compression helper including size metrics and saved percentage calculation
 */
export const compressDocumentWithMetrics = async (
  file: File,
  customOptions?: Partial<CompressionOptions>,
  onProgress?: (progressPercent: number) => void
): Promise<CompressionResult> => {
  const originalSize = file.size;
  const options: CompressionOptions & { onProgress?: (p: number) => void } = {
    ...DEFAULT_COMPRESSION_OPTIONS,
    ...customOptions,
    onProgress,
  };

  if (!file.type.startsWith('image/')) {
    // PDF or non-image
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savedPercentage: 0,
      isCompressed: false,
      originalFormatted: formatBytes(originalSize),
      compressedFormatted: formatBytes(originalSize),
    };
  }

  const compressedFile = await compressDocument(file, options);
  const compressedSize = compressedFile.size;
  const saved = originalSize > compressedSize ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : 0;

  return {
    file: compressedFile,
    originalSize,
    compressedSize,
    savedPercentage: saved,
    isCompressed: compressedSize < originalSize,
    originalFormatted: formatBytes(originalSize),
    compressedFormatted: formatBytes(compressedSize),
  };
};
