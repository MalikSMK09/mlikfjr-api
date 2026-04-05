import pino from 'pino';

const logger = pino({
  name: 'sabr-bypass',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

/**
 * SABR Bypass Utility
 * Provides methods to bypass YouTube SABR protection using various techniques
 */
export class SabrBypassUtil {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];

    // Multi-Client Strategy: Coba semua client resmi YouTube
    // Setiap client dapat daftar format berbeda, kena proteksi berbeda
    this.playerClients = [
      'android',        // Android app (paling reliable)
      'web',           // Web client
      'web_safari',    // Safari web client
      'tv_embedded',   // TV embedded player
      'ios',           // iOS app
      'mweb'           // Mobile web
    ];
    this.currentUAIndex = 0;
    this.currentClientIndex = 0;
  }

  /**
   * Get next user-agent in rotation
   */
  getNextUserAgent() {
    const ua = this.userAgents[this.currentUAIndex];
    this.currentUAIndex = (this.currentUAIndex + 1) % this.userAgents.length;
    logger.debug({ userAgent: ua.substring(0, 50) }, 'Rotated user-agent');
    return ua;
  }

  /**
   * Get next player client
   */
  getNextPlayerClient() {
    const client = this.playerClients[this.currentClientIndex];
    this.currentClientIndex = (this.currentClientIndex + 1) % this.playerClients.length;
    logger.debug({ client }, 'Rotated player client');
    return client;
  }

  /**
   * Generate yt-dlp arguments with SABR bypass techniques
   * @param {Object} options - Bypass options
   * @param {string} options.cookies - Cookie file path
   * @param {number} options.retryCount - Current retry attempt
   * @param {string} options.quality - Quality preference
   * @returns {Array} - Array of yt-dlp arguments
   */
  generateBypassArgs(options = {}) {
    const {
      cookies = null,
      retryCount = 0,
      quality = 'best'
    } = options;

    const args = [];

    // Adaptive Format Selection: Turunkan kualitas kalau retry count tinggi
    let targetQuality = quality;
    if (retryCount >= 2) {
      targetQuality = '720'; // Downgrade ke 720p
      logger.info({ retryCount, targetQuality }, 'Adaptive quality downgrade');
    } else if (retryCount >= 4) {
      targetQuality = '480'; // Downgrade lagi ke 480p
      logger.info({ retryCount, targetQuality }, 'Further quality downgrade');
    } else if (retryCount >= 6) {
      targetQuality = '360'; // Minimum 360p
      logger.info({ retryCount, targetQuality }, 'Minimum quality fallback');
    }

    // Multi-Client Masquerading: Coba client berbeda setiap retry
    const client = this.getNextPlayerClient();
    args.push('--extractor-args', `youtube:player_client=${client}`);
    logger.info({ retryCount, client, strategy: 'multi-client' }, 'Trying different YouTube client');

    // User-Agent rotation untuk variasi
    const userAgent = this.getNextUserAgent();
    args.push('--user-agent', userAgent);
    logger.debug({ userAgent: userAgent.substring(0, 50) }, 'Applied user-agent');

    // Add cookies if available
    if (cookies) {
      args.push('--cookies', cookies);
      logger.info({ cookies }, 'Using cookies for authentication');
    }

    // Add referer untuk terlihat seperti browser asli
    args.push('--referer', 'https://www.youtube.com/');
    logger.debug('Added referer header');

    // nsig Fallback Strategy: Skip nsig extraction kalau gagal
    args.push('--extractor-args', 'youtube:skip=nsig,player,manifest');
    logger.debug('nsig fallback enabled');

    // Throttle requests untuk hindari rate limiting
    args.push('--sleep-requests', '2');
    args.push('--throttled-rate', '100K');
    logger.debug('Request throttling enabled');

    // Flexible format selection: Coba berbagai format combination
    if (targetQuality === 'best') {
      args.push('-f', 'bv*+ba/b,best');
    } else if (['720', '480', '360'].includes(targetQuality)) {
      args.push('-f', `bv[height<=${targetQuality}]+ba/b,best`);
    } else {
      args.push('-f', 'bv*+ba/b');
    }

    // Add output template
    args.push('-o', 'downloads/%(id)s_%(autonumber)s.%(ext)s');

    // Skip strict certificate checking
    args.push('--no-check-certificates');

    logger.info({
      retryCount,
      client,
      quality: targetQuality,
      argsCount: args.length,
      strategy: 'adaptive_multi_client'
    }, 'Generated adaptive bypass arguments');

    return args;
  }

  /**
   * Get recommended retry delay based on SABR detection
   * @param {number} retryCount - Current retry attempt
   * @returns {number} - Delay in milliseconds
   */
  getBypassDelay(retryCount) {
    // Exponential backoff with SABR-specific delays
    const baseDelay = 5000; // 5 seconds
    const factor = Math.pow(2, retryCount);
    const maxDelay = 300000; // 5 minutes max

    const delay = Math.min(baseDelay * factor, maxDelay);

    logger.info({
      retryCount,
      delay,
      strategy: 'exponential_backoff'
    }, 'Calculated bypass delay');

    return delay;
  }

  /**
   * Check if URL is likely to trigger SABR
   * @param {string} url - YouTube URL
   * @returns {boolean} - True if likely to trigger SABR
   */
  isHighRiskUrl(url) {
    const urlLower = url.toLowerCase();

    // High-risk patterns
    const highRiskPatterns = [
      'music.youtube.com',
      'youtube.com/watch',
      'youtube.com/shorts',
      'youtube.com/live',
      'youtube.com/embed'
    ];

    const isHighRisk = highRiskPatterns.some(pattern => urlLower.includes(pattern));

    logger.debug({
      url: url.substring(0, 50),
      isHighRisk,
      patterns: highRiskPatterns.filter(p => urlLower.includes(p))
    }, 'Analyzed URL risk level');

    return isHighRisk;
  }

  /**
   * Get SABR bypass statistics
   */
  getStats() {
    return {
      userAgentRotation: {
        total: this.userAgents.length,
        current: this.currentUAIndex
      },
      playerClientRotation: {
        total: this.playerClients.length,
        current: this.currentClientIndex
      },
      strategies: [
        'Fresh Cookies',
        'Android Client',
        'User-Agent Rotation',
        'Request Throttling',
        'Referer Header'
      ]
    };
  }
}

export const sabrBypassUtil = new SabrBypassUtil();
