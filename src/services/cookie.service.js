import fs from 'fs-extra';
import path from 'path';
import pino from 'pino';

const logger = pino({
  name: 'cookie-service',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const COOKIES_DIR = 'cookies';

export class CookieService {
  constructor() {
    this.platforms = {
      youtube: 'youtube.txt',
      youtubemusic: 'youtubemusic.txt',
      spotify: 'spotify.txt',
      instagram: 'instagram.txt',
      threads: 'threads.txt',
      tiktok: 'tiktok.txt',
      twitter: 'twitter.txt',
      facebook: 'facebook.txt',
      pinterest: 'pinterest.txt',
      reddit: 'reddit.txt',
      fandom: 'fandom.txt',
      patreon: 'patreon.txt',
      twitch: 'twitch.txt',
      pixiv: 'pixiv.txt'
    };
    this.ensureCookiesDir();
  }

  async ensureCookiesDir() {
    try {
      await fs.ensureDir(COOKIES_DIR);
      logger.info('Cookies directory ensured');
    } catch (error) {
      logger.error({ error }, 'Failed to ensure cookies directory');
      throw error;
    }
  }

  getCookiePath(platform) {
    const normalizedPlatform = platform.toLowerCase();
    const filename = this.platforms[normalizedPlatform];

    if (!filename) {
      logger.warn({ platform }, 'Unknown platform for cookie');
      return null;
    }

    const cookiePath = path.join(COOKIES_DIR, filename);
    return cookiePath;
  }

  async hasCookie(platform) {
    try {
      const cookiePath = this.getCookiePath(platform);

      if (!cookiePath) {
        return false;
      }

      const exists = await fs.pathExists(cookiePath);

      if (exists) {
        const stats = await fs.stat(cookiePath);
        logger.info({
          platform,
          cookiePath,
          size: stats.size,
          modified: stats.mtime
        }, 'Cookie file found');
      }

      return exists;
    } catch (error) {
      logger.error({ platform, error }, 'Error checking cookie');
      return false;
    }
  }

  async getCookieContent(platform) {
    try {
      const cookiePath = this.getCookiePath(platform);

      if (!cookiePath || !(await this.hasCookie(platform))) {
        return null;
      }

      const content = await fs.readFile(cookiePath, 'utf8');
      return content;
    } catch (error) {
      logger.error({ platform, error }, 'Error reading cookie');
      return null;
    }
  }

  async listAvailableCookies() {
    const available = [];

    for (const [platform, filename] of Object.entries(this.platforms)) {
      const hasCookie = await this.hasCookie(platform);
      if (hasCookie) {
        available.push(platform);
      }
    }

    return available;
  }

  async getCookieInfo(platform) {
    const cookiePath = this.getCookiePath(platform);

    if (!cookiePath) {
      return null;
    }

    const exists = await fs.pathExists(cookiePath);

    if (!exists) {
      return {
        platform,
        available: false,
        path: cookiePath,
        message: 'Cookie file not found'
      };
    }

    const stats = await fs.stat(cookiePath);

    return {
      platform,
      available: true,
      path: cookiePath,
      size: stats.size,
      modified: stats.mtime
    };
  }

  static getPlatformFromUrl(url) {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('music.youtube.com') ||
        (urlLower.includes('youtube.com') && urlLower.includes('music'))) {
      return 'youtubemusic';
    }

    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return 'youtube';
    }

    if (urlLower.includes('open.spotify.com') || urlLower.includes('spotify.com')) {
      return 'spotify';
    }

    if (urlLower.includes('instagram.com')) {
      return 'instagram';
    }

    if (urlLower.includes('threads.net')) {
      return 'threads';
    }

    if (urlLower.includes('tiktok.com')) {
      return 'tiktok';
    }

    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      return 'twitter';
    }

    if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) {
      return 'facebook';
    }

    if (urlLower.includes('pinterest.com')) {
      return 'pinterest';
    }

    if (urlLower.includes('reddit.com') || urlLower.includes('redd.it')) {
      return 'reddit';
    }

    if (urlLower.includes('fandom.com') ||
        urlLower.includes('myanimelist.net') ||
        urlLower.includes('wikia.com')) {
      return 'fandom';
    }

    if (urlLower.includes('patreon.com')) {
      return 'patreon';
    }

    if (urlLower.includes('twitch.tv')) {
      return 'twitch';
    }

    if (urlLower.includes('pixiv.net') || urlLower.includes('pximg.net')) {
      return 'pixiv';
    }

    return null;
  }
}

export const cookieService = new CookieService();