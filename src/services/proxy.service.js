import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({
  name: 'proxy-service',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export class ProxyService {
  constructor() {
    this.proxies = [];
    this.currentProxyIndex = 0;
    this.usedProxies = new Set();
    this.proxyFilePath = path.join(__dirname, '..', '..', 'proxy.txt');
  }

  /**
   * Load proxies from proxy.txt file
   */
  loadProxies() {
    try {
      if (!fs.existsSync(this.proxyFilePath)) {
        logger.warn('proxy.txt not found');
        return [];
      }

      const content = fs.readFileSync(this.proxyFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      this.proxies = lines
        .map(line => line.trim())
        .filter(line => line.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/))
        .map(line => {
          // Append :80 if no port specified
          if (!line.includes(':')) {
            return `${line}:80`;
          }
          return line;
        });

      // Shuffle proxies randomly
      this.shuffleProxies();

      logger.info({ count: this.proxies.length }, 'Proxies loaded from proxy.txt');
      return this.proxies;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to load proxies');
      return [];
    }
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  shuffleProxies() {
    for (let i = this.proxies.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.proxies[i], this.proxies[j]] = [this.proxies[j], this.proxies[i]];
    }
  }

  /**
   * Get a random proxy for a specific platform
   * @param {string} platform - Platform name (tiktok, instagram, etc.)
   * @returns {string|null} - Proxy string or null if none available
   */
  getProxy(platform = 'tiktok') {
    // Only use proxies for platforms that need them
    const platformsNeedingProxy = ['tiktok', 'instagram', 'threads', 'twitter', 'facebook', 'patreon'];

    if (!platformsNeedingProxy.includes(platform.toLowerCase())) {
      return null;
    }

    // Load proxies if not loaded
    if (this.proxies.length === 0) {
      this.loadProxies();
    }

    if (this.proxies.length === 0) {
      return null;
    }

    // Reset if all proxies have been used
    if (this.usedProxies.size >= this.proxies.length) {
      logger.info('All proxies used, resetting proxy pool');
      this.usedProxies.clear();
      this.shuffleProxies();
    }

    // Find a proxy that hasn't been used
    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[i];
      if (!this.usedProxies.has(proxy)) {
        this.usedProxies.add(proxy);
        logger.debug({ proxy, platform }, 'Selected proxy');
        return proxy;
      }
    }

    // Fallback: return random proxy
    const randomProxy = this.proxies[Math.floor(Math.random() * this.proxies.length)];
    this.usedProxies.add(randomProxy);
    return randomProxy;
  }

  /**
   * Mark a proxy as failed and get a new one
   * @param {string} failedProxy - The proxy that failed
   * @param {string} platform - Platform name
   * @returns {string|null} - New proxy string or null
   */
  rotateProxy(failedProxy, platform = 'tiktok') {
    if (failedProxy) {
      logger.warn({ proxy: failedProxy }, 'Proxy failed, rotating');
      // Add to used set permanently so it won't be selected again
      this.usedProxies.add(failedProxy);
    }

    // Load proxies if not loaded
    if (this.proxies.length === 0) {
      this.loadProxies();
    }

    if (this.proxies.length === 0) {
      return null;
    }

    // Reset if all proxies have been used
    if (this.usedProxies.size >= this.proxies.length) {
      logger.info('All proxies used, resetting proxy pool');
      this.usedProxies.clear();
      this.shuffleProxies();
    }

    // Find a proxy that hasn't been used (skips the failed one permanently)
    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[i];
      if (!this.usedProxies.has(proxy)) {
        this.usedProxies.add(proxy);
        logger.info({ proxy, platform }, 'Rotated to new proxy');
        return proxy;
      }
    }

    // Fallback: return random proxy
    const randomProxy = this.proxies[Math.floor(Math.random() * this.proxies.length)];
    this.usedProxies.add(randomProxy);
    logger.info({ proxy: randomProxy, platform }, 'Rotated to random proxy');
    return randomProxy;
  }

  /**
   * Get proxy count
   */
  getProxyCount() {
    return this.proxies.length;
  }

  /**
   * Check if proxy file exists
   */
  hasProxies() {
    return this.proxies.length > 0;
  }

  /**
   * Get proxy headers for yt-dlp
   * @param {string} platform - Platform name
   * @returns {Object} - Headers object for proxy
   */
  getProxyHeaders(platform = 'tiktok') {
    // Generate realistic headers based on platform
    const userAgents = {
      tiktok: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      instagram: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      default: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const userAgent = userAgents[platform.toLowerCase()] || userAgents.default;

    return {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };
  }
}

export const proxyService = new ProxyService();
