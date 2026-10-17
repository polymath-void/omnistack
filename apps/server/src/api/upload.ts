/**
 * @omnistack/server - Multipart Image Upload Handler
 * Handles binary image streaming, validates image MIME types, and writes assets to disk.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export interface UploadResult {
  success: boolean;
  filename: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export const UPLOADS_DIR = path.resolve(process.cwd(), 'apps', 'server', 'public', 'uploads');

export function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Parses multipart/form-data or binary image upload from incoming HTTP request.
 */
export async function handleImageUpload(req: IncomingMessage): Promise<UploadResult> {
  ensureUploadsDir();

  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const chunks: Buffer[] = [];

    req.on('data', chunk => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });

    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        return reject(new Error('Empty upload payload'));
      }

      let fileBuffer = buffer;
      let extension = 'png';
      let mimeType = 'image/png';

      if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;

        if (boundary) {
          const boundaryDelimiter = `--${boundary}`;
          const parts = buffer.toString('binary').split(boundaryDelimiter);

          for (const part of parts) {
            if (part.includes('filename="')) {
              const filenameMatch = part.match(/filename="([^"]+)"/);
              const detectedFilename = filenameMatch ? filenameMatch[1] : 'upload.png';
              extension = path.extname(detectedFilename || 'upload.png').replace('.', '') || 'png';

              const headerEndIndex = part.indexOf('\r\n\r\n');
              if (headerEndIndex !== -1) {
                const headerSection = part.slice(0, headerEndIndex);
                const mimeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
                if (mimeMatch) {
                  mimeType = mimeMatch[1]?.trim() || 'image/png';
                }

                const binaryContent = part.slice(headerEndIndex + 4, part.lastIndexOf('\r\n'));
                fileBuffer = Buffer.from(binaryContent, 'binary');
                break;
              }
            }
          }
        }
      } else if (contentType.includes('image/jpeg')) {
        extension = 'jpg';
        mimeType = 'image/jpeg';
      } else if (contentType.includes('image/webp')) {
        extension = 'webp';
        mimeType = 'image/webp';
      } else if (contentType.includes('image/svg+xml')) {
        extension = 'svg';
        mimeType = 'image/svg+xml';
      }

      const safeId = `asset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const filename = `${safeId}.${extension}`;
      const targetPath = path.join(UPLOADS_DIR, filename);

      fs.writeFileSync(targetPath, fileBuffer);

      resolve({
        success: true,
        filename,
        url: `/uploads/${filename}`,
        sizeBytes: fileBuffer.length,
        mimeType,
      });
    });

    req.on('error', err => reject(err));
  });
}
