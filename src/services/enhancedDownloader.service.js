import pino from 'pino';
import fs from 'fs-extra';
import path from 'path';
import { ytdlpService } from './ytdlp.service.js';
import { spotdlService } from './spotdl.service.js';
import { downloadPixivMedia } from './pixiv.service.js';
import { classifyError } from './errorClassifier.service.js';
import { retryWithBackoff, isRetryable } from '../utils/retry.util.js';
import { mergeVideoAudio, getMediaInfo, getMimeType } from '../utils/merge.util.js';
import { cookieService } from './cookie.service.js';
import { platformService } from './platform.service.js';

const logger = pino({
  name: 'enhanced-downloader',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const DOWNLOADS_DIR = 'downloads';

export class EnhancedDownloaderService {
  constructor() {
    this.platformCapabilities = {
      youtube: {
        download: true,
        metadataOnly: false,
        cookieKey: 'youtube',
        supportedFormats: ['mp4', 'webm'],
        audioOnly: true,
        videoOnly: true
      },
      youtubemusic: {
        download: true,
        metadataOnly: false,
        cookieKey: 'youtubemusic',
        supportedFormats: ['mp4', 'webm'],
        audioOnly: true,
        videoOnly: true
      },
      spotify: {
        download: false, // Uses spotdl, different flow
        metadataOnly: true,
        cookieKey: 'spotify',
        supportedFormats: ['mp3'],
        audioOnly: true,
        videoOnly: false
      },
      instagram: {
        download: true,
        metadataOnly: false,
        cookieKey: 'instagram',
        supportedFormats: ['mp4', 'jpg', 'png'],
        audioOnly: false,
        videoOnly: true
      },
      tiktok: {
        download: true,
        metadataOnly: false,
        cookieKey: 'tiktok',
        supportedFormats: ['mp4'],
        audioOnly: false,
        videoOnly: true
      },
      twitter: {
        download: true,
        metadataOnly: false,
        cookieKey: 'twitter',
        supportedFormats: ['mp4', 'jpg', 'png'],
        audioOnly: false,
        videoOnly: true
      },
      facebook: {
        download: true,
        metadataOnly: false,
        cookieKey: 'facebook',
        supportedFormats: ['mp4'],
        audioOnly: false,
        videoOnly: true
      },
      pinterest: {
        download: true,
        metadataOnly: false,
        cookieKey: 'pinterest',
        supportedFormats: ['mp4', 'jpg', 'png'],
        audioOnly: false,
        videoOnly: true
      },
      threads: {
        download: true,
        metadataOnly: false,
        cookieKey: 'threads',
        supportedFormats: ['mp4', 'jpg'],
        audioOnly: false,
        videoOnly: true
      },
      reddit: {
        download: true,
        metadataOnly: false,
        cookieKey: 'reddit',
        supportedFormats: ['mp4', 'jpg', 'png'],
        audioOnly: false,
        videoOnly: true
      },
      fandom: {
        download: true,
        metadataOnly: false,
        cookieKey: 'fandom',
        supportedFormats: ['mp4'],
        audioOnly: false,
        videoOnly: true
      },
      patreon: {
        download: true,
        metadataOnly: false,
        cookieKey: 'patreon',
        supportedFormats: ['mp4', 'jpg', 'png'],
        audioOnly: false,
        videoOnly: true
      },
      twitch: {
        download: true,
        metadataOnly: false,
        cookieKey: 'twitch',
        supportedFormats: ['mp4'],
        audioOnly: false,
        videoOnly: true
      },
      pixiv: {
        download: true,
        metadataOnly: false,
        cookieKey: 'pixiv',
        supportedFormats: ['zip', 'jpg', 'png'],
        audioOnly: false,
        videoOnly: true
      }
    };
  }

  /**
   * Process a single URL with enhanced error handling and classification
   * @param {string} url - URL to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Result with success status and detailed error classification if failed
   */
  async processUrl(url, options = {}) {
    const {
      quality = 'best',
      mode = 'auto', // 'auto', 'audio-only', 'video-only', 'metadata-only'
      cookiesFolder = 'cookies',
      publicOnly = true,
      maxRetries = 2
    } = options;

    const startTime = Date.now();

    try {
      // Step 1: Validate URL
      const validation = this.validateUrl(url);
      if (!validation.valid) {
        return this.createErrorResponse(
          url,
          'USER_INPUT_ERROR',
          'URL tidak valid',
          ['Pastikan URL dimulai dengan http:// atau https://', 'Copy URL lengkap dari browser'],
          false
        );
      }

      // Step 2: Detect platform
      const platformInfo = platformService.detect(url);
      if (!platformInfo.validated) {
        return this.createErrorResponse(
          url,
          'UNSUPPORTED_PLATFORM',
          'Platform tidak didukung',
          ['Gunakan platform yang didukung (cek /api/platforms)', 'Pastikan URL dari platform yang didukung'],
          false
        );
      }

      const platform = platformInfo.id;
      const capabilities = this.platformCapabilities[platform] || {
        download: true,
        metadataOnly: true,
        cookieKey: platform,
        supportedFormats: ['mp4'],
        audioOnly: true,
        videoOnly: true
      };

      logger.info({
        url,
        platform,
        mode,
        quality
      }, 'Processing URL with enhanced downloader');

      // Step 3: Check if cookies are available if needed
      let cookiesPath = null;
      if (platformInfo.requiresCookie) {
        cookiesPath = cookieService.getCookiePath(platform);
        if (!cookiesPath && !publicOnly) {
          // Continue anyway, don't return error
        }
      }

      // Step 4: Special handling for Spotify (uses spotdl)
      if (platform === 'spotify') {
        return await this.handleSpotify(url, {
          cookiesPath,
          quality,
          mode
        });
      }

      // Step 5: Get metadata first
      const metadataResult = await this.getMetadata(url, platform, cookiesPath);

      let metadata = metadataResult.data;
      if (!metadataResult.success) {
        // Don't return early - continue to download even without metadata
        // This is the "force download" behavior the user requested
        metadata = null; // We'll proceed without metadata
      }

      // Step 6: Check if download is needed or just metadata
      if (mode === 'metadata-only' || !capabilities.download) {
        return this.createSuccessResponse(url, platform, [], metadata, {
          mode: 'metadata-only',
          message: 'Metadata retrieved successfully'
        });
      }

      // Step 7: Download with retry mechanism
      const downloadResult = await retryWithBackoff(
        async (attempt) => {
          return await this.downloadMedia(url, platform, cookiesPath, quality, metadata);
        },
        {
          retries: maxRetries,
          baseDelay: 2000,
          factor: 2,
          onRetry: (error, attemptNumber) => {
            logger.warn({
              url,
              platform,
              attempt: attemptNumber,
              error: error.message
            }, 'Retrying download');
          }
        }
      );

      if (!downloadResult.success) {
        const error = downloadResult.error;

        // Try to classify the error
        let classification;
        if (error.classifiedError) {
          classification = error.classifiedError;
        } else {
          classification = classifyError({
            stderr: error.stderr || '',
            stdout: error.stdout || '',
            exitCode: error.exitCode || 0,
            platform,
            message: error.message || error.toString(),
            url
          });
        }

        logger.error({
          url,
          platform,
          errorType: classification.type,
          attempts: downloadResult.attempts
        }, 'Download failed after retries');

        return this.createErrorResponse(
          url,
          classification.type,
          classification.reason,
          classification.suggestions,
          classification.retryable,
          platformInfo,
          downloadResult.data?.metadata || metadata,
          downloadResult.attempts
        );
      }

      // Step 8: Process downloaded files
      const processedFiles = await this.processDownloadedFiles(downloadResult.data.files);

      const duration = Date.now() - startTime;
      logger.info({
        url,
        platform,
        fileCount: processedFiles.length,
        duration
      }, 'URL processed successfully');

      return this.createSuccessResponse(url, platform, processedFiles, downloadResult.data?.metadata || metadata, {
        attempts: downloadResult.attempts,
        mode: mode,
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({
        url,
        error: error.message,
        stack: error.stack,
        duration
      }, 'Unexpected error during processing');

      return this.createErrorResponse(
        url,
        'INTERNAL_ERROR',
        'Terjadi kesalahan internal saat memproses request',
        ['Coba lagi dalam beberapa saat', 'Jika masalah berlanjut, hubungi admin'],
        true,
        null,
        null,
        0
      );
    }
  }

  /**
   * Validate URL format
   */
  validateUrl(url) {
    try {
      const parsed = new URL(url);
      const isValid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      return {
        valid: isValid,
        protocol: parsed.protocol,
        hostname: parsed.hostname
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get metadata for URL
   */
  async getMetadata(url, platform, cookiesPath) {
    try {
      const result = await ytdlpService.getInfo(url, {
        platform,
        cookies: cookiesPath,
        maxRetries: 5 // Increase retries to 5
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stderr: error.stderr || '',
        stdout: error.stdout || '',
        exitCode: error.exitCode || -1
      };
    }
  }

  /**
   * Download media for URL
   */
  async downloadMedia(url, platform, cookiesPath, quality, metadata) {
    const outputTemplate = `${DOWNLOADS_DIR}/${platform}_%(id)s_%(autonumber)s.%(ext)s`;

    // For Pinterest, try yt-dlp first to get video if exists
    // If no video formats found, fall back to direct image download
    if (platform === 'pinterest') {
      // First try yt-dlp (to get video if it's a video pin)
      const videoResult = await ytdlpService.download(url, {
        quality,
        platform,
        outputTemplate,
        cookies: cookiesPath,
        timeout: 300000,
        forceDownload: true
      });

      if (videoResult.success && videoResult.files.length > 0) {
        // Video found and downloaded successfully
        return videoResult;
      }

      // No video found - try direct image download
      logger.info({ url, videoError: videoResult.error }, 'Pinterest no video, trying direct image download...');

      const imageResult = await ytdlpService.downloadPinterestImage(url, outputTemplate);

      if (imageResult.success) {
        logger.info({ files: imageResult.files }, 'Pinterest image download succeeded (fallback)');

        const processedFiles = await this.processDownloadedFiles(imageResult.files);

        return {
          success: true,
          files: processedFiles,
          error: null,
          attempts: 1,
          metadata: null,
          classifiedError: null,
          isImageFallback: true,
          downloadMethod: 'fallback_image'
        };
      } else if (imageResult.error && imageResult.error.includes('Could not extract image URL')) {
        // Both video and image failed - URL likely invalid
        logger.warn({ url }, 'Pinterest URL not found or invalid');

        return {
          success: false,
          files: [],
          error: imageResult.error,
          attempts: 1,
          classifiedError: {
            type: 'USER_INPUT_ERROR',
            reason: 'URL Pinterest tidak ditemukan. Pastikan URL yang dikirim benar dan publik.',
            suggestions: [
              'Copy URL langsung dari browser (bukan dari search bar)',
              'Pastikan Pin bersifat public dan dapat diakses',
              'Cek apakah link Pin masih aktif di Pinterest',
              'Format URL yang benar: pinterest.com/pin/ID atau pin.it/SHORTCODE'
            ],
            retryable: false
          }
        };
      }

      // Other error from image download - return yt-dlp result
      return videoResult;
    }

    // For Pixiv, use the custom pixiv service (yt-dlp doesn't support pixiv)
    if (platform === 'pixiv') {
      logger.info({ url }, 'Using Pixiv service for download');

      const pixivResult = await downloadPixivMedia(url, {
        downloadDir: DOWNLOADS_DIR,
        cookies: cookiesPath ? await this.readCookieFile(cookiesPath) : null
      });

      if (pixivResult.success && pixivResult.data) {
        // Process the downloaded file
        const fileInfo = {
          filename: pixivResult.data.filename,
          path: path.join(DOWNLOADS_DIR, pixivResult.data.filename)
        };

        const processedFiles = await this.processDownloadedFiles([fileInfo]);

        return {
          success: true,
          files: processedFiles,
          error: null,
          attempts: 1,
          metadata: pixivResult.metadata ? [pixivResult.metadata] : null,
          classifiedError: null,
          downloadMethod: 'pixiv_service'
        };
      }

      // Download failed
      return {
        success: false,
        files: [],
        error: pixivResult.error?.reason || 'Download failed',
        attempts: 1,
        classifiedError: {
          type: pixivResult.error?.type || 'DOWNLOAD_FAILED',
          reason: pixivResult.error?.reason || 'Failed to download Pixiv artwork',
          suggestions: pixivResult.error?.suggestions || ['Coba lagi nanti'],
          retryable: false
        }
      };
    }

    // For Twitter, download all media (photos + videos) with counting fallback
    if (platform === 'twitter') {
      logger.info({ url }, 'Twitter: analyzing media in tweet');

      // Step 1: Get media info and count all media items
      const mediaInfo = await ytdlpService.getTwitterMediaInfo(url, {
        cookies: cookiesPath
      });

      if (!mediaInfo.success) {
        return {
          success: false,
          files: [],
          error: mediaInfo.error || 'Failed to analyze tweet',
          attempts: 1,
          classifiedError: {
            type: 'DOWNLOAD_FAILED',
            reason: 'Tidak dapat mengakses tweet ini',
            suggestions: ['Pastikan tweet bersifat publik', 'Coba lagi nanti'],
            retryable: false
          }
        };
      }

      logger.info({
        videoCount: mediaInfo.videoCount,
        photoCount: mediaInfo.photoCount,
        totalMedia: mediaInfo.totalMedia
      }, 'Twitter: found media count');

      const allFiles = [];

      // Step 2: Download video if available
      if (mediaInfo.videoCount > 0) {
        const videoResult = await ytdlpService.download(url, {
          quality,
          platform,
          outputTemplate,
          cookies: cookiesPath,
          timeout: 300000,
          forceDownload: true
        });

        if (videoResult.success && videoResult.files.length > 0) {
          allFiles.push(...videoResult.files);
          logger.info({ videoFiles: videoResult.files.length }, 'Twitter: downloaded video');
        }
      }

      // Step 3: Download photos if available
      if (mediaInfo.photoCount > 0) {
        const twitterImageTemplate = `${DOWNLOADS_DIR}/${platform}_%(id)s_img_%(autonumber)s.%(ext)s`;

        const imageResult = await ytdlpService.downloadTwitterImages(url, {
          cookies: cookiesPath,
          outputTemplate: twitterImageTemplate
        });

        if (imageResult.success && imageResult.files.length > 0) {
          allFiles.push(...imageResult.files);
          logger.info({ imageFiles: imageResult.files.length }, 'Twitter: downloaded photos');
        }
      }

      // Step 4: Return results
      if (allFiles.length > 0) {
        return {
          success: true,
          files: allFiles,
          error: null,
          attempts: 1,
          metadata: mediaInfo.tweetData ? [{
            title: mediaInfo.tweetData.title,
            uploader: mediaInfo.tweetData.uploader,
            thumbnail: mediaInfo.tweetData.thumbnail
          }] : null,
          classifiedError: null,
          downloadMethod: 'twitter_multi_media',
          mediaCount: {
            video: mediaInfo.videoCount,
            photo: mediaInfo.photoCount,
            total: mediaInfo.totalMedia
          }
        };
      }

      // No media found
      return {
        success: false,
        files: [],
        error: 'No media found in tweet',
        attempts: 1,
        classifiedError: {
          type: 'DOWNLOAD_FAILED',
          reason: 'Tidak ada media dalam tweet ini',
          suggestions: ['Pastikan tweet memiliki foto atau video'],
          retryable: false
        }
      };
    }

    // For other platforms, use yt-dlp
    const result = await ytdlpService.download(url, {
      quality,
      platform,
      outputTemplate,
      cookies: cookiesPath,
      timeout: 300000, // 5 minutes timeout
      forceDownload: true // Force download even with errors
    });

    return result;
  }

  /**
   * Read cookie file content
   */
  async readCookieFile(cookiePath) {
    try {
      return await fs.readFile(cookiePath, 'utf-8');
    } catch (error) {
      logger.warn({ cookiePath, error: error.message }, 'Failed to read cookie file');
      return null;
    }
  }

  /**
   * Process downloaded files (get file info, check for merge needed)
   */
  async processDownloadedFiles(files) {
    const processedFiles = [];
    const possibleExtensions = ['.mp3', '.m4a', '.flac', '.wav', '.mp4', '.webm'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

    for (const fileInfo of files) {
      if (!fileInfo.filename || !fileInfo.path) {
        continue;
      }

      try {
        // Start with the original path
        let originalPath = fileInfo.path;

        // Determine the actual file system path
        let fullPath = originalPath;

        // Check if it's a URL path (starts with /) or needs conversion
        if (originalPath.startsWith('/')) {
          // It's a URL path like /files/xxx, convert to actual file path
          const filename = path.basename(originalPath);
          fullPath = path.join('downloads', filename);
        } else if (!path.isAbsolute(originalPath)) {
          // It's a relative path, resolve it
          fullPath = path.resolve(originalPath);
        }
        // If it's already an absolute path (like D:\...), use it as-is

        // Check if file exists
        if (!(await fs.pathExists(fullPath))) {
          // Try adding extensions for video/audio files only
          const ext = path.extname(fileInfo.filename).toLowerCase();
          const isImage = imageExtensions.includes(ext);

          if (!isImage) {
            for (const extTry of possibleExtensions) {
              const tryPath = path.resolve(originalPath + extTry);
              if (await fs.pathExists(tryPath)) {
                fullPath = tryPath;
                break;
              }
            }
          }
        }

        // Check again if file exists
        if (!(await fs.pathExists(fullPath))) {
          logger.warn({
            file: fileInfo.filename,
            originalPath,
            fullPath
          }, 'Downloaded file not found');
          continue;
        }

        // Get the actual filename with extension
        const actualFilename = path.basename(fullPath);
        const ext = path.extname(actualFilename).toLowerCase();

        // Get file stats
        const stats = await fs.stat(fullPath);

        // Check if it's an image file
        const isImage = imageExtensions.includes(ext);

        // Get media info to check if it has audio (only for video/audio files)
        let hasAudio = true;
        if (!isImage) {
          try {
            const mediaInfo = await getMediaInfo(fullPath);
            hasAudio = mediaInfo.hasAudio;
          } catch (error) {
            logger.warn({
              file: actualFilename,
              error: error.message
            }, 'Failed to get media info, assuming has audio');
          }
        } else {
          // Images don't have audio
          hasAudio = false;
        }

        processedFiles.push({
          filename: actualFilename,
          path: `/files/${actualFilename}`,
          stored_path: fullPath,
          size_bytes: stats.size,
          mime: getMimeType(actualFilename),
          type: this.getFileType(actualFilename, hasAudio),
          created_at: stats.birthtime,
          modified_at: stats.mtime,
          has_audio: hasAudio
        });

      } catch (error) {
        logger.error({
          file: fileInfo.filename,
          error: error.message
        }, 'Failed to process downloaded file');
      }
    }

    return processedFiles;
  }

  /**
   * Get file type based on extension and audio presence
   */
  getFileType(filename, hasAudio) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video',
      '.webm': 'video',
      '.mkv': 'video',
      '.avi': 'video',
      '.mov': 'video',
      '.mp3': 'audio',
      '.m4a': 'audio',
      '.wav': 'audio',
      '.flac': 'audio',
      '.aac': 'audio',
      '.ogg': 'audio',
      '.opus': 'audio',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.png': 'image',
      '.webp': 'image',
      '.gif': 'image'
    };

    const mime = mimeTypes[ext] || 'file';

    // If it's a video file but has no audio, mark as video-only
    if (mime === 'video' && !hasAudio) {
      return 'video';
    }

    return mime;
  }

  /**
   * Handle Spotify downloads (uses spotdl)
   */
  async handleSpotify(url, options) {
    const { cookiesPath, quality, mode } = options;

    try {
      const result = await spotdlService.download(url, {
        outputDir: DOWNLOADS_DIR
      });

      if (result.success) {
        const processedFiles = await this.processDownloadedFiles(result.files);

        return this.createSuccessResponse(url, 'spotify', processedFiles, null, {
          mode: 'spotify-download',
          message: 'Downloaded via spotdl'
        });
      } else {
        const classification = classifyError({
          stderr: result.error || '',
          stdout: '',
          exitCode: 0,
          platform: 'spotify',
          message: result.error,
          url
        });

        return this.createErrorResponse(
          url,
          classification.type,
          classification.reason,
          classification.suggestions,
          classification.retryable,
          { id: 'spotify', name: 'Spotify' },
          null
        );
      }
    } catch (error) {
      logger.error({
        url,
        error: error.message
      }, 'Spotify download error');

      return this.createErrorResponse(
        url,
        'INTERNAL_ERROR',
        'Terjadi kesalahan saat memproses Spotify',
        ['Spotify menggunakan sistem terpisah (spotdl)', 'Coba lagi nanti'],
        true
      );
    }
  }

  /**
   * Create standardized success response
   */
  createSuccessResponse(url, platform, files, metadata, extra = {}) {
    return {
      success: true,
      url,
      platform,
      platformName: platformService.getPlatformConfig(platform)?.name || platform,
      files,
      metadata: this.formatMetadata(metadata),
      error: null,
      partialSuccess: false,
      ...extra
    };
  }

  /**
   * Create standardized error response with classification
   */
  createErrorResponse(
    url,
    type,
    reason,
    suggestions,
    retryable,
    platformInfo = null,
    metadata = null,
    attempts = 0
  ) {
    return {
      success: false,
      url,
      platform: platformInfo?.id || 'unknown',
      platformName: platformInfo?.name || 'Unknown',
      files: [],
      metadata: metadata ? this.formatMetadata(metadata) : null,
      error: {
        type,
        reason,
        suggestions,
        retryable
      },
      partialSuccess: false,
      attempts
    };
  }

  /**
   * Format metadata for response
   */
  formatMetadata(metadata) {
    if (!metadata || metadata.length === 0) {
      return null;
    }

    // Handle single item or array
    const items = Array.isArray(metadata) ? metadata : [metadata];

    return items.map(item => ({
      title: item.title || null,
      description: item.description ? item.description.substring(0, 500) : null,
      duration: item.duration || null,
      uploader: item.uploader || item.artist || null,  // Support both uploader (yt-dlp) and artist (pixiv)
      upload_date: item.upload_date || null,
      view_count: item.view_count || null,
      like_count: item.like_count || null,
      thumbnail: item.thumbnail || null,
      webpage_url: item.webpage_url || null
    }));
  }

  /**
   * Clean up old files
   */
  async cleanupOldFiles(hours = 24) {
    try {
      const now = Date.now();
      const maxAge = hours * 60 * 60 * 1000;
      const files = await fs.readdir(DOWNLOADS_DIR);

      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(DOWNLOADS_DIR, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.remove(filePath);
          cleanedCount++;
          logger.info({ file }, 'Cleaned up old file');
        }
      }

      logger.info({ cleanedCount }, 'Cleanup completed');
      return cleanedCount;
    } catch (error) {
      logger.error({ error }, 'Error during cleanup');
      throw error;
    }
  }
}

export const enhancedDownloaderService = new EnhancedDownloaderService();