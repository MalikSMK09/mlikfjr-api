import fs from 'fs-extra';
import path from 'path';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { ytdlpService } from './ytdlp.service.js';
import { spotdlService } from './spotdl.service.js';
import { cookieService } from './cookie.service.js';

const logger = pino({
  name: 'download-service',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const DOWNLOADS_DIR = 'downloads';

export class DownloadService {
  constructor() {
    this.ensureDownloadsDir();
  }

  async ensureDownloadsDir() {
    try {
      await fs.ensureDir(DOWNLOADS_DIR);
      logger.info('Downloads directory ensured');
    } catch (error) {
      logger.error({ error }, 'Failed to ensure downloads directory');
      throw error;
    }
  }

  async downloadUrls(urls, options = {}) {
    const {
      quality = 'best',
      includeMetadata = true
    } = options;

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    logger.info({
      urlCount: urls.length,
      quality
    }, 'Starting batch download');

    for (const urlInfo of urls) {
      try {
        const result = await this.downloadSingleUrl(urlInfo, {
          quality,
          includeMetadata
        });

        results.push(result);

        if (result.success && result.files.length > 0) {
          successCount++;
        } else {
          errorCount++;
        }

        logger.info({
          url: urlInfo.url,
          success: result.success,
          fileCount: result.files.length
        }, 'Single URL download completed');
      } catch (error) {
        logger.error({
          url: urlInfo.url,
          error: error.message
        }, 'Error downloading URL');

        errorCount++;
        results.push({
          url: urlInfo.url,
          platform: urlInfo.platform,
          success: false,
          files: [],
          metadata: null,
          error: error.message,
          partialSuccess: false
        });
      }
    }

    const summary = {
      total: urls.length,
      success: successCount,
      errors: errorCount,
      totalFiles: results.reduce((sum, r) => sum + r.files.length, 0)
    };

    logger.info(summary, 'Batch download completed');

    return {
      results,
      summary
    };
  }

  async downloadSingleUrl(urlInfo, options = {}) {
    const { url, platform } = urlInfo;
    const { quality = 'best', includeMetadata = true } = options;

    try {
      const platformInfo = platform;

      let cookies = null;
      const hasCookie = await cookieService.hasCookie(platform);

      if (hasCookie) {
        cookies = cookieService.getCookiePath(platform);
        logger.info({ url, platform, cookies }, 'Using cookie file');
      } else {
        logger.info({ url, platform }, 'No cookie file, proceeding without cookies');
      }

      let downloadResult;

      if (platform === 'spotify') {
        logger.info({ url, platform }, 'Using spotdl for Spotify download');
        downloadResult = await spotdlService.download(url, {
          outputDir: DOWNLOADS_DIR
        });
      } else {
        const outputTemplate = `${DOWNLOADS_DIR}/${platform}_%(id)s_%(autonumber)s.%(ext)s`;
        downloadResult = await ytdlpService.download(url, {
          quality,
          platform,
          outputTemplate,
          cookies
        });
      }

      if (downloadResult.success) {
        const files = [];
        const metadata = includeMetadata ? await this.getMetadata(url, platform, cookies) : null;

        for (const fileInfo of downloadResult.files) {
          if (fileInfo.filename) {
            const fileDetails = await this.getFileDetails(fileInfo);
            files.push(fileDetails);
          }
        }

        logger.info({
          url,
          platform,
          fileCount: files.length
        }, 'Download successful');

        return {
          url,
          platform,
          platformName: platformInfo?.name || platform,
          success: true,
          files,
          metadata,
          error: null,
          partialSuccess: false
        };
      } else {
        logger.error({
          url,
          platform,
          error: downloadResult.error
        }, 'Download failed');

        return {
          url,
          platform,
          platformName: platformInfo?.name || platform,
          success: false,
          files: [],
          metadata: null,
          error: downloadResult.error,
          partialSuccess: false
        };
      }
    } catch (error) {
      logger.error({
        url,
        platform,
        error: error.message
      }, 'Exception during download');

      return {
        url,
        platform,
        platformName: urlInfo.platformName || platform,
        success: false,
        files: [],
        metadata: null,
        error: error.message,
        partialSuccess: false
      };
    }
  }

  async getMetadata(url, platform, cookies) {
    try {
      const infoResult = await ytdlpService.getInfo(url, {
        platform,
        cookies
      });

      if (infoResult.success && infoResult.data.length > 0) {
        const item = infoResult.data[0];
        return {
          title: item.title || null,
          description: item.description ? item.description.substring(0, 500) : null,
          duration: item.duration || null,
          uploader: item.uploader || null,
          upload_date: item.upload_date || null,
          view_count: item.view_count || null,
          like_count: item.like_count || null,
          thumbnail: item.thumbnail || null,
         webpage_url: item.webpage_url || url
        };
      }

      return null;
    } catch (error) {
      logger.warn({ error: error.message }, 'Failed to get metadata');
      return null;
    }
  }

  async getFileDetails(fileInfo) {
    const { filename, path: filePath } = fileInfo;
    const fullPath = path.resolve(filePath);

    try {
      const stats = await fs.stat(fullPath);
      const mimeType = this.getMimeType(filename);

      return {
        filename,
        path: `/files/${filename}`,
        size_bytes: stats.size,
        mime: mimeType,
        type: mimeType.startsWith('video/') ? 'video' :
              mimeType.startsWith('audio/') ? 'audio' :
              mimeType.startsWith('image/') ? 'image' : 'file',
        created_at: stats.birthtime,
        modified_at: stats.mtime
      };
    } catch (error) {
      logger.warn({ filename, error: error.message }, 'Failed to get file details');
      return {
        filename,
        path: `/files/${filename}`,
        size_bytes: 0,
        mime: 'application/octet-stream',
        type: 'unknown'
      };
    }
  }

  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

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

export const downloadService = new DownloadService();