import { spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import { classifyError } from './errorClassifier.service.js';
import { sabrBypassUtil } from '../utils/sabrBypass.util.js';
import { proxyService } from './proxy.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const readdir = promisify(fs.readdir);

const logger = pino({
  name: 'ytdlp-service',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

/**
 * Run yt-dlp command using child_process.spawn with proper timeout handling
 */
async function runYtDlp(args, options = {}) {
  const { timeout = 300000, cwd = process.cwd() } = options;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn('yt-dlp', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000); // Give it 5 seconds to terminate gracefully
    }, timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        reject(new Error(`Command timed out after ${timeout}ms`));
        return;
      }

      resolve({
        stdout,
        stderr,
        exitCode: code
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

export class YtDlpService {
  constructor(maxRetries = 3) {
    this.maxRetries = maxRetries;
    this.retryDelay = 2000;
    this.currentProxy = null;
  }

  async download(url, options = {}) {
    const {
      quality = 'best',
      platform = 'generic',
      outputTemplate = 'downloads/%(id)s_%(autonumber)s.%(ext)s',
      cookies = null,
      timeout = 300000,
      forceDownload = false
    } = options;

    // Get proxy for platforms that need it
    const platformsNeedingProxy = ['tiktok', 'instagram', 'threads', 'twitter', 'facebook', 'patreon'];
    if (platformsNeedingProxy.includes(platform.toLowerCase())) {
      this.currentProxy = proxyService.getProxy(platform);
      if (this.currentProxy) {
        logger.info({ proxy: this.currentProxy, platform }, 'Using proxy for download');
      }
    }

    // Get video metadata first
    let videoMetadata = null;
    let videoMetadataRaw = null;
    try {
      const metaResult = await this.getVideoMetadata(url, { cookies, platform });
      if (metaResult.success && metaResult.data?.[0]) {
        videoMetadataRaw = metaResult.data[0];
        videoMetadata = {
          title: videoMetadataRaw.title || 'Unknown',
          artist: videoMetadataRaw.artist || videoMetadataRaw.uploader || videoMetadataRaw.channel || 'Unknown',
          description: videoMetadataRaw.description || '',
          url: url,
          thumbnail: videoMetadataRaw.thumbnail || videoMetadataRaw.thumbnails?.[0]?.url || null,
          duration: videoMetadataRaw.duration || null,
          viewCount: videoMetadataRaw.view_count || null,
          uploadDate: videoMetadataRaw.upload_date || null
        };
        logger.info({ title: videoMetadata.title, artist: videoMetadata.artist }, 'Video metadata retrieved');
      }
    } catch (metaError) {
      logger.warn({ error: metaError.message }, 'Failed to get video metadata');
    }

    let lastError;
    let lastStderr = '';
    let lastStdout = '';
    let lastExitCode = 0;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info({
          url,
          platform,
          attempt,
          maxRetries: this.maxRetries,
          proxy: this.currentProxy
        }, 'Starting download attempt');

        const result = await this.runYtDlp(url, {
          quality,
          platform,
          outputTemplate,
          cookies,
          timeout,
          proxy: this.currentProxy
        });

        if (result.success) {
          logger.info({
            url,
            platform,
            attempt,
            files: result.files.length
          }, 'Download successful');

          return {
            success: true,
            files: result.files,
            error: null,
            attempts: attempt,
            classifiedError: null,
            metadata: videoMetadata ? [videoMetadataRaw] : null
          };
        }

        lastError = result.error;
        lastStderr = result.stderr || '';
        lastStdout = result.stdout || '';
        lastExitCode = result.exitCode || 0;

        logger.warn({
          url,
          platform,
          attempt,
          error: lastError,
          exitCode: lastExitCode
        }, 'Download attempt failed');

        const classification = classifyError({
          stderr: lastStderr,
          stdout: lastStdout,
          exitCode: lastExitCode,
          platform,
          message: lastError,
          url
        });

        const shouldRetry = forceDownload
          ? classification.type !== 'USER_INPUT_ERROR' && classification.type !== 'UNSUPPORTED_PLATFORM'
          : classification.retryable;

        if (!shouldRetry || attempt >= this.maxRetries) {
          logger.error({
            url,
            platform,
            attempts: attempt,
            errorType: classification.type,
            reason: classification.reason,
            forceDownload
          }, 'Download failed with non-retryable error');

          return {
            success: false,
            files: [],
            error: lastError,
            attempts: attempt,
            classifiedError: classification,
            metadata: videoMetadata ? [videoMetadataRaw] : null
          };
        }

        // Rotate proxy if IP is blocked or network error
        if ((classification.type === 'IP_BLOCKED' || classification.type === 'NETWORK_ERROR') && this.currentProxy) {
          logger.warn({ currentProxy: this.currentProxy, errorType: classification.type }, 'Proxy failed, rotating proxy');
          this.currentProxy = proxyService.rotateProxy(this.currentProxy, platform);
          if (this.currentProxy) {
            logger.info({ newProxy: this.currentProxy }, 'Rotated to new proxy');
          }
        }

        // Generate SABR bypass arguments for YouTube
        let bypassArgs = [];
        if (classification.type === 'EXTERNAL_PLATFORM_PROTECTION' &&
            (platform === 'youtube' || platform === 'youtubemusic')) {
          bypassArgs = sabrBypassUtil.generateBypassArgs({
            cookies,
            retryCount: attempt - 1,
            quality
          });

          logger.info({
            attempt,
            errorType: classification.type,
            bypassStrategies: bypassArgs.length,
            argsPreview: bypassArgs.slice(0, 3).join(' ')
          }, 'Applying SABR bypass strategy');
        }

        const delay = classification.type === 'EXTERNAL_PLATFORM_PROTECTION'
          ? sabrBypassUtil.getBypassDelay(attempt - 1)
          : this.calculateDelay(classification, attempt);

        logger.info({
          attempt,
          delay,
          errorType: classification.type,
          usingBypass: bypassArgs.length > 0
        }, 'Retrying after delay');

        if (attempt < this.maxRetries) {
          await this.delay(delay);
        }
      } catch (error) {
        lastError = error.message;
        logger.error({
          url,
          platform,
          attempt,
          error: error.message
        }, 'Download attempt threw error');

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    const finalClassification = classifyError({
      stderr: lastStderr,
      stdout: lastStdout,
      exitCode: lastExitCode,
      platform,
      message: lastError,
      url
    });

    logger.error({
      url,
      platform,
      attempts: this.maxRetries,
      errorType: finalClassification.type,
      error: lastError
    }, 'Download failed after all retries');

    return {
      success: false,
      files: [],
      error: lastError,
      attempts: this.maxRetries,
      classifiedError: finalClassification,
      metadata: videoMetadata ? [videoMetadataRaw] : null
    };
  }

  calculateDelay(classification, attempt) {
    let delay = this.retryDelay * attempt;

    switch (classification.type) {
      case 'RATE_LIMIT':
        delay = Math.max(delay, 5000);
        break;
      case 'NETWORK_ERROR':
        delay = Math.max(delay, 2000);
        break;
      case 'EXTERNAL_PLATFORM_PROTECTION':
        delay = Math.max(delay, 10000);
        break;
      default:
        break;
    }

    return delay;
  }

  async getInfo(url, options = {}) {
    const { platform = 'generic', cookies = null, maxRetries = 5 } = options;

    const platformsNeedingProxy = ['tiktok', 'instagram', 'threads', 'twitter', 'facebook', 'patreon'];
    if (platformsNeedingProxy.includes(platform.toLowerCase())) {
      this.currentProxy = proxyService.getProxy(platform);
    }

    let lastError;
    let lastStderr = '';
    let lastStdout = '';
    let lastExitCode = 0;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info({
          url,
          platform,
          attempt,
          maxRetries,
          proxy: this.currentProxy
        }, 'Getting video info attempt');

        let bypassArgs = [];
        if ((platform === 'youtube' || platform === 'youtubemusic') && attempt > 1) {
          bypassArgs = sabrBypassUtil.generateBypassArgs({
            cookies,
            retryCount: attempt - 1,
            quality: 'best'
          });

          logger.info({
            attempt,
            client: bypassArgs.find(arg => arg.includes('player_client'))?.split('=')[1] || 'unknown',
            bypassStrategies: bypassArgs.length
          }, 'Applying SABR bypass for metadata');
        }

        const result = await this.runYtDlpInfo(url, {
          platform,
          cookies,
          bypassArgs,
          proxy: this.currentProxy
        });

        if (result.success) {
          logger.info({
            url,
            platform,
            attempt,
            hasOutput: !!result.output
          }, 'Video info retrieved successfully');

          return {
            success: true,
            data: result.data,
            error: null
          };
        }

        lastError = result.error;
        lastStderr = result.stderr || '';
        lastStdout = result.stdout || '';
        lastExitCode = result.exitCode || 0;

        logger.warn({
          url,
          platform,
          attempt,
          error: lastError,
          exitCode: lastExitCode
        }, 'Get info attempt failed');

        const classification = classifyError({
          stderr: lastStderr,
          stdout: lastStdout,
          exitCode: lastExitCode,
          platform,
          message: lastError,
          url
        });

        if (!classification.retryable || attempt >= maxRetries) {
          logger.error({
            url,
            platform,
            attempts: attempt,
            errorType: classification.type
          }, 'Get info failed with non-retryable error');

          return {
            success: false,
            data: null,
            error: lastError,
            classifiedError: classification
          };
        }

        if ((classification.type === 'IP_BLOCKED' || classification.type === 'NETWORK_ERROR') && this.currentProxy) {
          logger.warn({ currentProxy: this.currentProxy, errorType: classification.type }, 'Proxy failed, rotating proxy');
          this.currentProxy = proxyService.rotateProxy(this.currentProxy, platform);
          if (this.currentProxy) {
            logger.info({ newProxy: this.currentProxy }, 'Rotated to new proxy');
          }
        }

        const delay = classification.type === 'EXTERNAL_PLATFORM_PROTECTION'
          ? sabrBypassUtil.getBypassDelay(attempt - 1)
          : this.retryDelay * attempt;

        logger.info({
          attempt,
          delay,
          errorType: classification.type
        }, 'Retrying get info after delay');

        if (attempt < maxRetries) {
          await this.delay(delay);
        }
      } catch (error) {
        lastError = error.message;
        logger.error({
          url,
          platform,
          attempt,
          error: error.message
        }, 'Get info attempt threw error');

        if (attempt < maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    const finalClassification = classifyError({
      stderr: lastStderr,
      stdout: lastStdout,
      exitCode: lastExitCode,
      platform,
      message: lastError,
      url
    });

    logger.error({
      url,
      platform,
      attempts: maxRetries,
      errorType: finalClassification.type
    }, 'Get info failed after all retries');

    return {
      success: false,
      data: null,
      error: lastError,
      classifiedError: finalClassification
    };
  }

  async runYtDlpInfo(url, options) {
    const { platform, cookies, bypassArgs = [], timeout = 300000, proxy = null } = options;

    const args = [
      ...bypassArgs,
      '--dump-json',
      '--no-download',
      '--no-playlist', 'false',
      url
    ];

    if (cookies) {
      args.unshift('--cookies', cookies);
    }

    // Skip proxy for Twitter as direct connection works better
    const shouldUseProxyForInfo = proxy && platform !== 'twitter';

    if (shouldUseProxyForInfo) {
      args.unshift('--proxy', proxy);
      logger.debug({ proxy }, 'Using proxy for info');

      const headers = proxyService.getProxyHeaders(platform);
      const headersString = Object.entries(headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\r\n');

      args.unshift('--proxy-headers', headersString);
      logger.debug({ headersCount: Object.keys(headers).length }, 'Added proxy headers for info');
    } else if (platform === 'twitter') {
      logger.debug({ reason: 'Skipping proxy for Twitter info' }, 'Using direct connection');
    }

    logger.debug({ args: args.join(' ') }, 'Running yt-dlp for info');

    try {
      const result = await runYtDlp(args, { timeout: 180000 }); // 3 minutes

      const lines = result.stdout.trim().split('\n').filter(line => line.trim());
      const jsonData = lines.map(line => JSON.parse(line));

      logger.info({
        url,
        platform,
        count: jsonData.length
      }, 'Video info retrieved');

      return {
        success: true,
        data: jsonData,
        output: result.stdout,
        error: null,
        stderr: '',
        stdout: result.stdout,
        exitCode: 0
      };
    } catch (error) {
      const errorMessage = error.message || 'Unknown error';

      logger.error({
        url,
        platform,
        error: errorMessage
      }, 'yt-dlp failed to get info');

      return {
        success: false,
        data: null,
        output: '',
        error: errorMessage,
        stderr: errorMessage,
        stdout: '',
        exitCode: 1
      };
    }
  }

  async runYtDlp(url, options) {
    const {
      quality,
      platform,
      outputTemplate,
      cookies,
      timeout = 300000,
      bypassArgs = [],
      proxy = null
    } = options;

    let formatArg;

    // YouTube Music uses HLS with combined video+audio streams
    // Format selection must use "best" selector since no separate audio streams
    if (platform === 'youtubemusic') {
      if (quality === 'best' || quality === 'audio') {
        // Download best quality HLS stream (contains both video+audio)
        // Then extract audio with -x for music
        formatArg = 'best[ext=m4a]/best[ext=mp4]/bestvideo+bestaudio';
      } else if (['720', '480', '360'].includes(quality)) {
        formatArg = `best[height<=${quality}]/bestvideo+bestaudio[height<=${quality}]`;
      } else {
        formatArg = 'best/bestvideo+bestaudio';
      }
    } else {
      // Regular YouTube and other platforms
      if (quality === 'best') {
        formatArg = 'bv*+ba/b*';
      } else if (['720', '480', '360'].includes(quality)) {
        formatArg = `bv[height<=${quality}]+ba[ext=m4a]/b[height<=${quality}]`;
      } else {
        formatArg = quality;
      }
    }

    const args = [
      ...bypassArgs,
      '-f', formatArg,
      '--merge-output-format', 'mp4',
      '--no-playlist', 'false',
      '-o', outputTemplate,
      '--embed-metadata',
      '--force-overwrites', // Always overwrite to ensure fresh download
      // YouTube Music: extract audio if audio mode
      ...(platform === 'youtubemusic' && (quality === 'audio' || quality === 'best')
        ? ['-x', '--audio-format', 'mp3', '--audio-quality', '0']
        : []),
      // YouTube Music HLS optimization
      ...(platform === 'youtubemusic' ? ['--hls-use-mpegts', '--no-check-certificates'] : []),
      url
    ];

    if (cookies) {
      args.unshift('--cookies', cookies);
    }

    // Skip proxy for Instagram and Twitter as they may not work with random public proxies
    // Twitter often requires direct connection, and Instagram has its own handling
    const shouldUseProxy = proxy && platform !== 'instagram' && platform !== 'twitter';

    if (shouldUseProxy) {
      args.unshift('--proxy', proxy);
      logger.debug({ proxy }, 'Using proxy for download');

      const headers = proxyService.getProxyHeaders(platform);
      const headersString = Object.entries(headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\r\n');

      args.unshift('--proxy-headers', headersString);
      logger.debug({ headersCount: Object.keys(headers).length }, 'Added proxy headers');
    } else if (platform === 'instagram') {
      logger.debug({ reason: 'Skipping proxy for Instagram' }, 'Using direct connection');
    }

    logger.debug({ args: args.join(' ') }, 'Running yt-dlp command');

    // Record existing files before download to avoid returning old files
    const outputDir = path.dirname(outputTemplate);
    let existingFiles = new Set();
    try {
      const preFiles = await readdir(outputDir);
      preFiles.forEach(f => existingFiles.add(f));
      logger.debug({ existingFileCount: existingFiles.size, files: [...existingFiles] }, 'Recorded existing files');
    } catch (e) {
      // Directory might not exist yet
      logger.debug({ outputDir }, 'Output directory does not exist yet');
    }

    try {
      const result = await runYtDlp(args, { timeout: 300000 }); // 5 minutes for downloads

      // Scan output directory for NEW downloaded files only
      const dirFiles = await readdir(outputDir);

      logger.debug({
        dirFiles: dirFiles.length,
        existingFiles: existingFiles.size,
        platform
      }, 'Scanning directory for downloaded files');

      const downloadedFiles = dirFiles
        .filter(f => {
          const ext = path.extname(f).toLowerCase();
          const validExts = ['.mp4', '.webm', '.mkv', '.m4a', '.mp3', '.zip', '.jpg', '.png', '.webp', '.jpeg', '.gif'];

          // Check if file matches platform pattern
          const matchesPlatform = f.startsWith(platform + '_') || f.includes(platform);

          // If download succeeded (exitCode === 0) and file matches platform pattern, include it
          // This handles cases where file already existed (was overwritten during download)
          const downloadSucceeded = result.exitCode === 0;
          if (downloadSucceeded && matchesPlatform && validExts.includes(ext)) {
            return true;
          }

          // For failed downloads, only return truly new files
          const isNewFile = !existingFiles.has(f);
          return validExts.includes(ext) &&
                 matchesPlatform &&
                 isNewFile;
        })
        .map(f => ({
          filename: f,
          path: path.join(outputDir, f)
        }));

      logger.info({
        outputDir,
        totalFiles: dirFiles.length,
        newFiles: downloadedFiles.length,
        platform
      }, 'Scanning output directory for newly downloaded files');

      return {
        success: true,
        files: downloadedFiles,
        error: null,
        stderr: '',
        stdout: result.stdout,
        exitCode: 0
      };
    } catch (error) {
      // Some platforms may exit with code 1 but still download files
      const errorMessage = error.message || 'Unknown error';

      // Try to find NEW downloaded files even on error
      try {
        const dirFiles = await readdir(outputDir);
        const downloadedFiles = dirFiles
          .filter(f => {
            const ext = path.extname(f).toLowerCase();
            const validExts = ['.mp4', '.webm', '.mkv', '.m4a', '.mp3', '.zip', '.jpg', '.png', '.webp', '.jpeg', '.gif'];
            // Only include files that didn't exist before download
            return validExts.includes(ext) &&
                   (f.startsWith(platform + '_') || f.includes(platform)) &&
                   !existingFiles.has(f);
          })
          .map(f => ({
            filename: f,
            path: path.join(outputDir, f)
          }));

        if (downloadedFiles.length > 0) {
          logger.info({
            url,
            platform,
            newFiles: downloadedFiles.length
          }, 'Download completed despite error');

          return {
            success: true,
            files: downloadedFiles,
            error: null,
            stderr: errorMessage,
            stdout: '',
            exitCode: 0
          };
        }
      } catch (scanError) {
        logger.error({ error: scanError.message }, 'Failed to scan output directory');
      }

      logger.error({
        url,
        platform,
        error: errorMessage
      }, 'Download failed');

      return {
        success: false,
        files: [],
        error: errorMessage,
        stderr: errorMessage,
        stdout: '',
        exitCode: 1
      };
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getVideoMetadata(url, options = {}) {
    const { cookies = null, platform = 'generic' } = options;

    const args = [
      '--dump-json',
      '--no-download',
      '--no-playlist', 'false'
    ];

    if (cookies) {
      args.unshift('--cookies', cookies);
    }

    if (platform === 'youtubemusic') {
      args.push('--extractor-args', 'youtube:player_client=web_music');
    }

    args.push(url);

    try {
      const result = await runYtDlp(args, { timeout: 180000 }); // 3 minutes for metadata

      const lines = result.stdout.trim().split('\n').filter(line => line.trim());
      const jsonData = lines.map(line => JSON.parse(line));

      if (jsonData.length > 0) {
        const info = jsonData[0];
        // Return in same format as getInfo (array format for formatMetadata compatibility)
        return {
          success: true,
          data: [info],
          error: null,
          classifiedError: null
        };
      }

      return { success: false, data: null, error: 'No metadata found', classifiedError: null };
    } catch (error) {
      logger.error({ url, error: error.message }, 'Failed to get metadata');
      return { success: false, data: null, error: error.message, classifiedError: null };
    }
  }

  async checkYtDlpInstalled() {
    try {
      const result = await runYtDlp(['--version']);
      return !!result.stdout;
    } catch {
      return false;
    }
  }

  /**
   * Download Pinterest image by extracting image URL from page HTML
   * This handles image-only pins that yt-dlp doesn't support
   */
  async downloadPinterestImage(url, outputTemplate = 'downloads/pinterest_image_%(id)s.%(ext)s') {
    logger.info({ url }, 'Extracting Pinterest image URL');

    try {
      // Fetch Pinterest page to extract image URL
      const fetchResult = await runCurl(['-sL', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', url], { timeout: 30000 });

      // Extract original image URL from HTML
      const imageUrlMatch = fetchResult.stdout.match(/"url":"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"/);

      if (!imageUrlMatch) {
        // Try alternatives
        const altMatch = fetchResult.stdout.match(/"url":"(https:\/\/i\.pinimg\.com\/[^"]+\.(?:jpg|png|webp))"/);
        if (!altMatch) {
          throw new Error('Could not extract image URL from Pinterest page');
        }
        return this.downloadImage(altMatch[1], url, outputTemplate, 'pinterest');
      }

      const imageUrl = imageUrlMatch[1];
      logger.info({ imageUrl }, 'Found Pinterest image URL');

      // Download the image
      return this.downloadImage(imageUrl, url, outputTemplate, 'pinterest');
    } catch (error) {
      logger.error({ url, error: error.message }, 'Failed to download Pinterest image');
      return {
        success: false,
        files: [],
        error: error.message
      };
    }
  }

  /**
   * Generic image download helper
   */
  async downloadImage(imageUrl, sourceUrl, outputTemplate, platform) {
    logger.info({ imageUrl }, 'Downloading image');

    // Determine file extension from URL
    const urlExt = path.extname(imageUrl).toLowerCase() || '.jpg';
    const ext = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(urlExt) ? urlExt : '.jpg';

    // Create output path with proper template
    const pinIdMatch = sourceUrl.match(/pin\/(\d+)/);
    const pinId = pinIdMatch ? pinIdMatch[1] : Date.now().toString();
    const filename = `${platform}_image_${pinId}${ext}`;
    const outputPath = path.join(process.cwd(), 'downloads', filename);

    try {
      // Download using curl
      await runCurl(['-L', '-o', outputPath, '-A', 'Mozilla/5.0', imageUrl], { timeout: 60000 });

      // Verify file was downloaded
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      logger.info({ filename, size: stats.size }, 'Image downloaded successfully');

      return {
        success: true,
        files: [{
          filename,
          path: outputPath
        }],
        error: null
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to download image');
      return {
        success: false,
        files: [],
        error: error.message
      };
    }
  }

  /**
   * Download Twitter images only (separate from videos)
   * Uses --download-sections to extract images from tweet metadata
   */
  async downloadTwitterImages(url, options = {}) {
    const { cookies = null, outputTemplate = 'downloads/twitter_%(id)s_img_%(autonumber)s.%(ext)s' } = options;

    logger.info({ url }, 'Downloading Twitter images only');

    // First, get tweet metadata to find image URLs
    const args = [
      '--dump-json',
      '--no-download',
      '--no-playlist', 'false'
    ];

    if (cookies) {
      args.unshift('--cookies', cookies);
    }

    try {
      const result = await runYtDlp(args, { timeout: 120000 });
      const lines = result.stdout.trim().split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        return { success: false, files: [], error: 'No metadata found' };
      }

      const data = JSON.parse(lines[0]);
      const images = [];

      // Extract images from entities.media
      const media = data.entities?.media || [];
      for (const item of media) {
        if (item.type === 'photo') {
          // Get highest quality image URL
          let imageUrl = item.media_url_https;
          if (item.sizes) {
            // Use large size if available
            if (item.sizes.large) {
              imageUrl = item.media_url_https + ':large';
            } else if (item.sizes.medium) {
              imageUrl = item.media_url_https + ':medium';
            } else if (item.sizes.small) {
              imageUrl = item.media_url_https + ':small';
            }
          }

          images.push({
            url: imageUrl,
            alt: item.alt_text || 'Twitter image',
            index: images.length
          });
        }
      }

      // Fallback: if no photos in entities but has thumbnail (video tweet), use thumbnail
      if (images.length === 0 && data.thumbnail && data.thumbnail.includes('twimg.com')) {
        // Check if there's video content (indicates this is a video tweet)
        const hasVideo = data.formats && data.formats.some(f => f.vcodec && f.vcodec !== 'none');
        if (hasVideo) {
          images.push({
            url: data.thumbnail,
            alt: 'Video thumbnail',
            index: images.length
          });
          logger.info({ thumbnail: data.thumbnail }, 'Using video thumbnail as fallback image');
        }
      }

      if (images.length === 0) {
        logger.debug({ tweetId: data.id }, 'No images found in tweet');
        return { success: true, files: [], error: null }; // No images, not an error
      }

      logger.info({ imageCount: images.length }, 'Found images in tweet');

      // Download each image
      const downloadedFiles = [];
      const outputDir = path.dirname(outputTemplate);
      let existingFiles = new Set();

      try {
        const preFiles = await readdir(outputDir);
        preFiles.forEach(f => existingFiles.add(f));
      } catch (e) {
        // Directory might not exist
      }

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const ext = path.extname(img.url).toLowerCase() || '.jpg';
        const filename = `twitter_${data.id}_img_${String(i + 1).padStart(2, '0')}${ext}`;
        const filepath = path.join(process.cwd(), outputDir, filename);

        try {
          await runCurl(['-L', '-o', filepath, '-A', 'Mozilla/5.0', img.url], { timeout: 60000 });

          const stats = fs.statSync(filepath);
          if (stats.size > 0) {
            downloadedFiles.push({ filename, path: filepath });
            logger.info({ filename, size: stats.size }, 'Image downloaded');
          }
        } catch (curlError) {
          logger.warn({ url: img.url, error: curlError.message }, 'Failed to download image');
        }

        // Small delay between downloads
        if (i < images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (downloadedFiles.length > 0) {
        return { success: true, files: downloadedFiles, error: null };
      }

      return { success: false, files: [], error: 'Failed to download any images' };

    } catch (error) {
      logger.error({ url, error: error.message }, 'Failed to download Twitter images');
      return { success: false, files: [], error: error.message };
    }
  }

  /**
   * Get all media info from a tweet (count and list all media items)
   * Returns video count, photo count, and detailed media info
   */
  async getTwitterMediaInfo(url, options = {}) {
    const { cookies = null } = options;

    logger.info({ url }, 'Getting Twitter media info');

    const args = [
      '--dump-json',
      '--no-download',
      '--no-playlist', 'false'
    ];

    if (cookies) {
      args.unshift('--cookies', cookies);
    }

    try {
      const result = await runYtDlp(args, { timeout: 120000 });
      const lines = result.stdout.trim().split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        return { success: false, videoCount: 0, photoCount: 0, mediaItems: [], error: 'No metadata found' };
      }

      const data = JSON.parse(lines[0]);
      const mediaItems = [];
      let videoCount = 0;
      let photoCount = 0;

      // Check for video formats
      if (data.formats && data.formats.length > 0) {
        const videoFormats = data.formats.filter(f => f.vcodec && f.vcodec !== 'none' && f.ext === 'mp4');
        if (videoFormats.length > 0) {
          // Get best quality video
          const bestVideo = videoFormats.sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0))[0];
          mediaItems.push({
            type: 'video',
            url: bestVideo.url,
            extension: 'mp4',
            width: bestVideo.width,
            height: bestVideo.height,
            description: `Video ${bestVideo.width || 0}x${bestVideo.height || 0}`
          });
          videoCount = 1;
        }
      }

      // Check for photos in entities.media
      const mediaEntities = data.entities?.media || data.extended_entities?.media || [];
      for (const item of mediaEntities) {
        if (item.type === 'photo') {
          let imageUrl = item.media_url_https;
          if (item.sizes) {
            if (item.sizes.large) imageUrl += ':large';
            else if (item.sizes.medium) imageUrl += ':medium';
            else if (item.sizes.small) imageUrl += ':small';
          }

          mediaItems.push({
            type: 'photo',
            url: imageUrl,
            extension: 'jpg',
            alt: item.alt_text || 'Twitter image',
            description: 'Photo'
          });
          photoCount++;
        }
      }

      // Also add thumbnail as fallback photo (when video exists but no photos in entities)
      // This matches the standalone script behavior
      if (videoCount > 0 && photoCount === 0 && data.thumbnail && data.thumbnail.includes('twimg.com')) {
        // Add thumbnail as a separate photo item
        mediaItems.push({
          type: 'photo',
          url: data.thumbnail,
          extension: 'jpg',
          description: 'Video thumbnail'
        });
        photoCount = 1;
        logger.info({ thumbnail: data.thumbnail }, 'Added video thumbnail as fallback photo');
      }

      logger.info({ videoCount, photoCount, totalMedia: mediaItems.length }, 'Twitter media count');

      return {
        success: true,
        videoCount,
        photoCount,
        totalMedia: mediaItems.length,
        mediaItems,
        tweetData: {
          id: data.id,
          uploader: data.uploader,
          title: data.title,
          thumbnail: data.thumbnail
        }
      };

    } catch (error) {
      logger.error({ url, error: error.message }, 'Failed to get Twitter media info');
      return { success: false, videoCount: 0, photoCount: 0, mediaItems: [], error: error.message };
    }
  }
}

/**
 * Run curl command using child_process.spawn with proper timeout handling
 */
async function runCurl(args, options = {}) {
  const { timeout = 60000 } = options;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn('curl', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      if (timedOut) {
        reject(new Error(`curl timed out after ${timeout}ms`));
        return;
      }
      resolve({ stdout, stderr, exitCode: code });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

export const ytdlpService = new YtDlpService();
