import pino from 'pino';
import { body, validationResult } from 'express-validator';
import { extractorService } from '../services/extractor.service.js';
import { enhancedDownloaderService } from '../services/enhancedDownloader.service.js';
import { uuidService } from '../services/uuid.service.js';
import { cookieService } from '../services/cookie.service.js';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

const logger = pino({
  name: 'download-controller',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export const downloadValidation = [
  body('text')
    .notEmpty()
    .withMessage('Text field is required')
    .isLength({ min: 1 })
    .withMessage('Text cannot be empty'),
  body('quality')
    .optional()
    .isIn(['best', 'worst', '720', '480', '360'])
    .withMessage('Quality must be: best, worst, 720, 480, or 360'),
  body('mode')
    .optional()
    .isIn(['auto', 'audio-only', 'video-only', 'metadata-only'])
    .withMessage('Mode must be: auto, audio-only, video-only, or metadata-only'),
  body('publicOnly')
    .optional()
    .isBoolean()
    .withMessage('publicOnly must be a boolean'),
  body('maxRetries')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('maxRetries must be an integer between 0 and 5')
];

export async function handleDownload(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({
        errors: errors.array()
      }, 'Validation failed');
      return res.status(400).json({
        status: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      text,
      quality = 'best',
      mode = 'auto',
      publicOnly = true,
      maxRetries = 2
    } = req.body;

    logger.info({
      apiKeyType: req.apiKeyType,
      textLength: text.length,
      quality,
      mode,
      publicOnly
    }, 'Download request received');

    const extraction = extractorService.extractFromText(text);

    if (extraction.urls.length === 0) {
      logger.warn('No URLs found in text');
      return res.status(400).json({
        status: false,
        error: 'No URLs found in the provided text',
        suggestion: 'Please include at least one valid URL from supported platforms'
      });
    }

    const validUrls = extraction.urls.filter(u => u.valid);

    if (validUrls.length === 0) {
      logger.warn('No valid URLs found');
      const unsupportedUrls = extraction.urls.filter(u => !u.valid);
      return res.status(400).json({
        status: false,
        error: 'No valid URLs found',
        unsupportedUrls: unsupportedUrls.map(u => ({
          url: u.url,
          error: u.error
        })),
        supportedPlatforms: extractorService.getSupportedPlatforms()
      });
    }

    logger.info({
      validUrlCount: validUrls.length,
      platformCounts: extraction.summary.platforms
    }, 'Processing valid URLs');

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const urlInfo of validUrls) {
      try {
        const result = await enhancedDownloaderService.processUrl(urlInfo.url, {
          quality,
          mode,
          publicOnly,
          maxRetries
        });

        // If download succeeded and files include stored_path, move them into a per-request token folder
        if (result.success && result.files && result.files.length > 0) {
          try {
            const token = uuidService.generate().data.uuid.split('-')[0];
            const tokenDir = path.join('downloads', token);
            await fs.promises.mkdir(tokenDir, { recursive: true });

            // Move each file into tokenDir and update file paths and public URLs
            for (const f of result.files) {
              if (f.stored_path && f.filename) {
                const dest = path.join(tokenDir, f.filename);
                try {
                  await fs.promises.rename(f.stored_path, dest);
                } catch (err) {
                  // fallback to copy+unlink if rename fails across filesystems
                  await fs.promises.copyFile(f.stored_path, dest);
                  await fs.promises.unlink(f.stored_path);
                }
                f.path = `/files/${token}/${f.filename}`;
                f.public_url = `${req.protocol}://${req.get('host')}${f.path}`;
                // remove stored_path to avoid leaking internal paths
                delete f.stored_path;
              }
            }

            // Include a friendly request-level URL (first file)
            result.request_url = `${req.protocol}://${req.get('host')}/${token}/1`;
          } catch (err) {
            logger.warn({ err: err.message }, 'Failed to move downloaded files to token folder');
          }
        }

        results.push(result);

        if (result.success && result.files.length > 0) {
          successCount++;
        } else {
          errorCount++;
        }

        logger.info({
          url: urlInfo.url,
          success: result.success,
          fileCount: result.files?.length || 0,
          errorType: result.error?.type || null
        }, 'Single URL processing completed');
      } catch (error) {
        logger.error({
          url: urlInfo.url,
          error: error.message
        }, 'Error processing URL');

        errorCount++;
        results.push({
          success: false,
          url: urlInfo.url,
          platform: urlInfo.platform,
          platformName: urlInfo.platformName || urlInfo.platform,
          files: [],
          metadata: null,
          error: {
            type: 'INTERNAL_ERROR',
            reason: 'Terjadi kesalahan internal saat memproses URL',
            suggestions: ['Coba lagi dalam beberapa saat', 'Jika masalah berlanjut, hubungi admin'],
            retryable: true
          },
          partialSuccess: false
        });
      }
    }

    const summary = {
      total: validUrls.length,
      success: successCount,
      errors: errorCount,
      totalFiles: results.reduce((sum, r) => sum + (r.files?.length || 0), 0)
    };

    logger.info({
      totalUrls: results.length,
      successfulUrls: successCount,
      totalFiles: summary.totalFiles
    }, 'Download completed');

    res.json({
      status: successCount > 0,
      message: successCount > 0 ? 'Download completed successfully' : 'Download failed',
      data: {
        urlsProcessed: results.length,
        successful: successCount,
        failed: errorCount,
        totalFiles: summary.totalFiles,
        results
      },
      summary
    });
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack
    }, 'Unhandled error in download handler');

    res.status(500).json({
      status: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

export async function handleFileAccess(req, res) {
  try {
    const { token, filename } = req.params;

    if (!filename || filename.includes('..') || filename.includes('\\')) {
      logger.warn({ filename, token }, 'Invalid filename');
      return res.status(400).json({
        status: false,
        error: 'Invalid filename'
      });
    }

    // Support both /files/:filename and /files/:token/:filename
    const filePath = token ? path.join('downloads', token, filename) : path.join('downloads', filename);

    if (!fs.existsSync(filePath)) {
      logger.warn({ filename }, 'File not found');
      return res.status(404).json({
        status: false,
        error: 'File not found',
        filename
      });
    }

    const stat = fs.statSync(filePath);
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    logger.info({
      filename,
      size: stat.size,
      mimeType
    }, 'Serving file');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

    readStream.on('error', (error) => {
      logger.error({ filename, error: error.message }, 'Error streaming file');
      if (!res.headersSent) {
        res.status(500).json({
          status: false,
          error: 'Error streaming file'
        });
      }
    });
  } catch (error) {
    logger.error({
      filename: req.params.filename,
      error: error.message
    }, 'Error in file access handler');

    res.status(500).json({
      status: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

export async function handleGetPlatforms(req, res) {
  try {
    const platforms = extractorService.getSupportedPlatforms();
    const cookieInfo = await Promise.all(
      platforms.map(async p => ({
        platform: p.id,
        name: p.name,
        requiresCookie: p.requiresCookie,
        supportsMultiMedia: p.supportsMultiMedia,
        cookieAvailable: await cookieService.hasCookie(p.id)
      }))
    );

    res.json({
      status: true,
      data: {
        platforms: cookieInfo,
        total: cookieInfo.length
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting platforms');
    res.status(500).json({
      status: false,
      error: 'Failed to get platform information'
    });
  }
}