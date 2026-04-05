import pino from 'pino';
import { platformService } from './platform.service.js';

const logger = pino({
  name: 'extractor-service',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export class ExtractorService {
  constructor() {
    this.urlPatterns = [
      /(https?:\/\/[^\s]+)/gi,
      /(http?:\/\/[^\s]+)/gi
    ];
  }

  extractUrls(text) {
    if (!text || typeof text !== 'string') {
      logger.warn('Invalid text input for URL extraction');
      return [];
    }

    const urls = [];
    const seen = new Set();

    for (const pattern of this.urlPatterns) {
      const matches = text.match(pattern) || [];
      for (const url of matches) {
        const cleanUrl = this.cleanUrl(url);
        if (!seen.has(cleanUrl) && this.isValidUrl(cleanUrl)) {
          seen.add(cleanUrl);
          urls.push(cleanUrl);
        }
      }
    }

    logger.info({ count: urls.length }, 'URLs extracted from text');
    return urls;
  }

  cleanUrl(url) {
    return url
      .replace(/[),.!?]+$/, '')
      .replace(/["']/g, '')
      .trim();
  }

  isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:');
    } catch (error) {
      return false;
    }
  }

  validateAndDetect(url) {
    if (!this.isValidUrl(url)) {
      logger.warn({ url }, 'Invalid URL format');
      return {
        url,
        valid: false,
        error: 'Invalid URL format'
      };
    }

    // Special check for YouTube Community Post URLs - provide specific error
    if (url.includes('youtube.com/post/')) {
      return {
        url,
        valid: false,
        platform: 'youtube',
        error: 'YouTube Community Post tidak didukung. Gunakan link video/shorts/playlist YouTube yang valid.'
      };
    }

    const platform = platformService.detect(url);

    if (!platform.validated) {
      logger.warn({ url }, 'Unsupported platform');
      return {
        url,
        valid: false,
        platform: platform.id,
        error: platform.error || 'Platform not supported'
      };
    }

    logger.info({
      url,
      platform: platform.id
    }, 'URL validated and platform detected');

    return {
      url,
      valid: true,
      platform: platform.id,
      platformName: platform.name,
      requiresCookie: platform.requiresCookie,
      supportsMultiMedia: platform.supportsMultiMedia,
      extractors: platform.extractors
    };
  }

  extractFromText(text) {
    const urls = this.extractUrls(text);
    const results = [];

    for (const url of urls) {
      const validation = this.validateAndDetect(url);

      if (validation.valid) {
        results.push(validation);
      } else {
        results.push({
          url,
          valid: false,
          error: validation.error
        });
      }
    }

    const validCount = results.filter(r => r.valid).length;
    const invalidCount = results.length - validCount;

    logger.info({
      total: results.length,
      valid: validCount,
      invalid: invalidCount
    }, 'URL extraction summary');

    return {
      urls: results,
      summary: {
        total: results.length,
        valid: validCount,
        invalid: invalidCount,
        platforms: this.getPlatformCounts(results.filter(r => r.valid))
      }
    };
  }

  getPlatformCounts(validUrls) {
    const counts = {};
    validUrls.forEach(item => {
      counts[item.platform] = (counts[item.platform] || 0) + 1;
    });
    return counts;
  }

  groupByPlatform(urls) {
    const grouped = {};

    urls.forEach(item => {
      if (item.valid && item.platform) {
        if (!grouped[item.platform]) {
          grouped[item.platform] = {
            platform: item.platform,
            platformName: item.platformName,
            urls: [],
            requiresCookie: item.requiresCookie,
            supportsMultiMedia: item.supportsMultiMedia
          };
        }
        grouped[item.platform].urls.push(item.url);
      }
    });

    return grouped;
  }

  getSupportedPlatforms() {
    return platformService.getSupportedPlatforms();
  }

  isUrlSupported(url) {
    const platform = platformService.detect(url);
    return platform.validated;
  }
}

export const extractorService = new ExtractorService();