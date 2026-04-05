import pino from 'pino';

const logger = pino({
  name: 'platform-service',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export class PlatformService {
  constructor() {
    this.platforms = {
      youtube: {
        name: 'YouTube',
        match: [
          /youtube\.com\/watch/,
          /youtu\.be\//,
          /youtube\.com\/shorts/,
          /youtube\.com\/playlist/,
          /youtube\.com\/live/
          // Note: /youtube\.com\/post/ removed - yt-dlp doesn't support Community Post URLs
        ],
        requiresCookie: false,
        supportsMultiMedia: true,
        extractors: ['yt-dlp']
      },
      youtubemusic: {
        name: 'YouTube Music',
        match: [
          /music\.youtube\.com/,
          /youtube\.com\/watch.*&feature=youtube\.gd/
        ],
        requiresCookie: true,
        supportsMultiMedia: true,
        extractors: ['yt-dlp']
      },
      spotify: {
        name: 'Spotify',
        match: [
          /open\.spotify\.com\/track/,
          /open\.spotify\.com\/album/,
          /open\.spotify\.com\/playlist/,
          /open\.spotify\.com\/artist/
        ],
        requiresCookie: true,
        supportsMultiMedia: true,
        extractors: ['yt-dlp', 'spotdl']
      },
      instagram: {
        name: 'Instagram',
        match: [
          /instagram\.com\/p\//,
          /instagram\.com\/reel\//,
          /instagram\.com\/tv\//,
          /instagram\.com\/stories\//
        ],
        requiresCookie: true,
        supportsMultiMedia: true,
        extractors: ['yt-dlp']
      },
      threads: {
        name: 'Threads',
        match: [
          /threads\.net\/@/,
          /threads\.net\/t\//
        ],
        requiresCookie: true,
        supportsMultiMedia: true,
        extractors: ['yt-dlp']
      },
      tiktok: {
        name: 'TikTok',
        match: [
          /tiktok\.com\/@/,
          /tiktok\.com\/v\//,
          /vm\.tiktok\.com/,
          /vt\.tiktok\.com/
        ],
        requiresCookie: true,
        supportsMultiMedia: false,
        extractors: ['yt-dlp']
      },
      twitter: {
        name: 'Twitter/X',
        match: [
          /twitter\.com\//,
          /x\.com\//
        ],
        requiresCookie: true,
        supportsMultiMedia: true,
        extractors: ['yt-dlp']
      },
      facebook: {
        name: 'Facebook',
        match: [
          /facebook\.com\//,
          /fb\.watch\//
        ],
        requiresCookie: true,
        supportsMultiMedia: true,
        extractors: ['yt-dlp']
      },
      pinterest: {
        name: 'Pinterest',
        match: [
          /pinterest\.com\//,
          /pin\.it\//
        ],
        requiresCookie: false,
        supportsMultiMedia: false,
        extractors: ['yt-dlp']
      },
      reddit: {
        name: 'Reddit',
        match: [
          /reddit\.com\//,
          /redd\.it\//
        ],
        requiresCookie: false,
        supportsMultiMedia: false,
        extractors: ['yt-dlp']
      },
      fandom: {
        name: 'Fandom (Anime/Wiki)',
        match: [
          /fandom\.com\//,
          /myanimelist\.net\//,
          /wikia\.com\//
        ],
        requiresCookie: false,
        supportsMultiMedia: false,
        extractors: ['yt-dlp']
      },
      patreon: {
        name: 'Patreon',
        match: [
          /patreon\.com\//
        ],
        requiresCookie: true,
        supportsMultiMedia: true,
        extractors: ['yt-dlp']
      },
      twitch: {
        name: 'Twitch',
        match: [
          /twitch\.tv\//
        ],
        requiresCookie: true,
        supportsMultiMedia: false,
        extractors: ['yt-dlp']
      },
      pixiv: {
        name: 'Pixiv',
        match: [
          /pixiv\.net\//,
          /pximg\.net\//
        ],
        requiresCookie: true,
        supportsMultiMedia: false,
        extractors: ['yt-dlp']
      }
    };
  }

  detect(url) {
    const urlLower = url.toLowerCase();

    // More specific platforms first to avoid false matches
    const priorityOrder = [
      'youtubemusic',
      'spotify',
      'instagram',
      'threads',
      'tiktok',
      'twitter',
      'facebook',
      'pinterest',
      'reddit',
      'fandom',
      'patreon',
      'twitch',
      'pixiv',
      'youtube'
    ];

    // Check platforms in priority order
    for (const platformId of priorityOrder) {
      const config = this.platforms[platformId];
      if (config && config.match.some(pattern => pattern.test(urlLower))) {
        logger.info({ url, platform: platformId }, 'Platform detected');
        return {
          id: platformId,
          name: config.name,
          requiresCookie: config.requiresCookie,
          supportsMultiMedia: config.supportsMultiMedia,
          extractors: config.extractors,
          validated: true
        };
      }
    }

    logger.warn({ url }, 'Platform not supported');
    return {
      id: 'unknown',
      name: 'Unknown',
      requiresCookie: false,
      supportsMultiMedia: false,
      extractors: [],
      validated: false,
      error: 'Platform not supported'
    };
  }

  validateUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  getSupportedPlatforms() {
    return Object.entries(this.platforms).map(([id, config]) => ({
      id,
      name: config.name,
      requiresCookie: config.requiresCookie,
      supportsMultiMedia: config.supportsMultiMedia
    }));
  }

  isPlatformSupported(platformId) {
    return this.platforms.hasOwnProperty(platformId);
  }

  getPlatformConfig(platformId) {
    return this.platforms[platformId] || null;
  }
}

export const platformService = new PlatformService();