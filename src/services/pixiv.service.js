import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PIXIV_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Pixiv Download Service
 * Downloads artwork images from pixiv.net using multiple strategies
 */

// ============================================================================
// STRATEGY 1: Pixiv API (Primary)
// ============================================================================

async function strategyPixivApi(artworkUrl, options = {}) {
  const { maxRetries = 3, cookies = null } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Pixiv-Strategy1] Attempt ${attempt}/${maxRetries}: Pixiv API`);

      // Extract artwork ID from URL
      const artworkMatch = artworkUrl.match(/artworks\/(\d+)/);
      if (!artworkMatch) {
        throw new Error('Invalid Pixiv artwork URL');
      }

      const artworkId = artworkMatch[1];
      const apiUrl = `https://www.pixiv.net/ajax/illust/${artworkId}`;

      const headers = {
        'User-Agent': PIXIV_UA,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.pixiv.net/'
      };

      // Add cookies if available
      if (cookies) {
        headers['Cookie'] = cookies;
      }

      const response = await axios.get(apiUrl, {
        headers,
        timeout: 20000
      });

      if (!response.data?.body) {
        throw new Error('Empty response from Pixiv API');
      }

      const illust = response.data.body;

      // Get image URLs
      const imageUrls = extractImageUrls(illust, artworkUrl);

      if (imageUrls.length > 0) {
        console.log(`[Pixiv-Strategy1] SUCCESS: Found ${imageUrls.length} image(s)`);

        // Download first image
        const downloaded = await downloadPixivImage(imageUrls[0], artworkUrl, options);

        if (downloaded) {
          return {
            success: true,
            strategy: 'pixiv_api',
            attempt,
            data: downloaded,
            metadata: {
              title: illust.title,
              artist: illust.userName,
              description: illust.description,
              viewCount: illust.viewCount,
              likeCount: illust.likeCount,
              imageCount: imageUrls.length
            }
          };
        }
      }

    } catch (error) {
      console.log(`[Pixiv-Strategy1] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = Math.min(1500 * Math.pow(2, attempt) + Math.random() * 500, 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, strategy: 'pixiv_api' };
}

// ============================================================================
// STRATEGY 2: HTML Page Parsing (Fallback 1)
// ============================================================================

async function strategyHtmlParsing(artworkUrl, options = {}) {
  const { maxRetries = 2, cookies = null } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Pixiv-Strategy2] Attempt ${attempt}/${maxRetries}: HTML parsing`);

      const headers = {
        'User-Agent': PIXIV_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      };

      if (cookies) {
        headers['Cookie'] = cookies;
      }

      const response = await axios.get(artworkUrl, {
        headers,
        timeout: 20000
      });

      const html = response.data;

      // Extract image URLs from various sources in the HTML
      const imageUrls = extractUrlsFromHtml(html, artworkUrl);

      if (imageUrls.length > 0) {
        console.log(`[Pixiv-Strategy2] Found ${imageUrls.length} image(s) in HTML`);

        const downloaded = await downloadPixivImage(imageUrls[0], artworkUrl, options);

        if (downloaded) {
          return {
            success: true,
            strategy: 'html_parsing',
            attempt,
            data: downloaded,
            metadata: { source: 'html_parsing', originalUrl: artworkUrl }
          };
        }
      }

    } catch (error) {
      console.log(`[Pixiv-Strategy2] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = Math.min(1500 * Math.pow(2, attempt) + Math.random() * 500, 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, strategy: 'html_parsing' };
}

// ============================================================================
// STRATEGY 3: Direct Image Download (Fallback 2)
// ============================================================================

async function strategyDirectDownload(artworkUrl, options = {}) {
  const { maxRetries = 2, cookies = null } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Pixiv-Strategy3] Attempt ${attempt}/${maxRetries}: Direct download`);

      // Try common pixiv image URL patterns
      const artworkMatch = artworkUrl.match(/artworks\/(\d+)/);
      if (!artworkMatch) {
        throw new Error('Invalid Pixiv artwork URL');
      }

      const artworkId = artworkMatch[1];

      // Try common pixiv image hosting patterns
      const possibleUrls = [
        `https://i.pixiv.re/img-original/img/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${artworkId}_p0.jpg`,
        `https://img-original.pixiv.net/img/${artworkId}/p0.jpg`,
        `https://i.pixiv.net/img-original/img/${artworkId}_p0.jpg`
      ];

      for (const imageUrl of possibleUrls) {
        try {
          console.log(`[Pixiv-Strategy3] Trying: ${imageUrl.substring(0, 80)}...`);

          const headers = {
            'User-Agent': PIXIV_UA,
            'Referer': 'https://www.pixiv.net/'
          };

          if (cookies) {
            headers['Cookie'] = cookies;
          }

          const headResponse = await axios.head(imageUrl, {
            headers,
            timeout: 10000
          });

          if (headResponse.status === 200) {
            const downloaded = await downloadPixivImage(imageUrl, artworkUrl, options);

            if (downloaded) {
              return {
                success: true,
                strategy: 'direct_download',
                attempt,
                data: downloaded,
                metadata: { source: 'direct_url', originalUrl: artworkUrl }
              };
            }
          }
        } catch (e) {
          // Continue to next URL
        }
      }

    } catch (error) {
      console.log(`[Pixiv-Strategy3] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * attempt + Math.random() * 300, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, strategy: 'direct_download' };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract image URLs from Pixiv API response
 */
function extractImageUrls(illust, originalUrl) {
  const urls = [];

  if (!illust) return urls;

  // Check for original images
  if (illust.metaPages && illust.metaPages.length > 0) {
    // Multi-page artwork
    for (const page of illust.metaPages) {
      if (page.urls?.original) {
        urls.push(page.urls.original);
      }
    }
  }

  // Check for single page
  if (illust.urls?.original) {
    urls.push(illust.urls.original);
  }

  // Check for regular URLs
  if (illust.urls?.regular) {
    urls.push(illust.urls.regular);
  }

  // Check for ugoira (animation)
  if (illust.ugoiraMetadata) {
    if (illust.ugoiraMetadata.src) {
      urls.push(illust.ugoiraMetadata.src);
    }
  }

  return [...new Set(urls)]; // Remove duplicates
}

/**
 * Extract image URLs from HTML page
 */
function extractUrlsFromHtml(html, originalUrl) {
  const urls = [];

  // Try to find JSON data in the page
  const jsonMatch = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi);

  if (jsonMatch) {
    for (const match of jsonMatch) {
      try {
        const jsonContent = match.replace(/<\/?script[^>]*>/gi, '');
        const data = JSON.parse(jsonContent);

        // Look for image URLs in the data
        if (data.illust) {
          const illust = data.illust;
          if (illust.urls?.original) {
            urls.push(illust.urls.original);
          }
          if (illust.metaPages) {
            for (const page of illust.metaPages) {
              if (page.urls?.original) {
                urls.push(page.urls.original);
              }
            }
          }
        }
      } catch (e) {
        // Not valid JSON, continue
      }
    }
  }

  // Alternative: Look for img-original in src attributes
  const srcMatch = html.match(/src="([^"]*pixiv\.net\/img-original[^"]*)"/g);
  if (srcMatch) {
    for (const match of srcMatch) {
      const url = match.replace(/src="([^"]*)"/, '$1');
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  // Look for i.pixiv.re URLs
  const pixivReMatch = html.match(/src="([^"]*i\.pixiv\.re[^"]*)"/g);
  if (pixivReMatch) {
    for (const match of pixivReMatch) {
      const url = match.replace(/src="([^"]*)"/, '$1');
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * Download a Pixiv image
 */
async function downloadPixivImage(imageUrl, originalUrl, options = {}) {
  const { downloadDir = path.join(__dirname, '../../downloads') } = options;

  try {
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    // Determine file extension from URL
    let ext = path.extname(imageUrl).toLowerCase();
    if (!ext || ext === '.jpeg') {
      ext = imageUrl.includes('.png') ? '.png' : '.jpg';
    }

    const artworkMatch = originalUrl.match(/artworks\/(\d+)/);
    const artworkId = artworkMatch ? artworkMatch[1] : Date.now().toString();

    const filename = `pixiv_${artworkId}${ext}`;
    const filepath = path.join(downloadDir, filename);

    console.log(`[Pixiv-Download] Fetching: ${imageUrl.substring(0, 80)}...`);

    const headers = {
      'User-Agent': PIXIV_UA,
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.pixiv.net/'
    };

    // Add cookies if available
    if (options.cookies) {
      headers['Cookie'] = options.cookies;
    }

    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream',
      headers,
      timeout: 60000
    });

    const writer = fs.createWriteStream(filepath);

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const stat = fs.statSync(filepath);
    if (stat.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    console.log(`[Pixiv-Download] Saved: ${filename} (${stat.size} bytes)`);

    return {
      filename,
      filepath: filename,
      size: stat.size,
      type: 'image',
      mime: getMimeType(ext),
      originalUrl
    };

  } catch (error) {
    console.log(`[Pixiv-Download] Failed: ${error.message}`);
    return null;
  }
}

/**
 * Get MIME type from extension
 */
function getMimeType(ext) {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Validate Pixiv URL
 */
export function isValidPixivUrl(url) {
  try {
    const urlObj = new URL(url);
    const isPixiv = urlObj.hostname === 'www.pixiv.net' || urlObj.hostname === 'pixiv.net';
    const hasArtwork = urlObj.pathname.includes('/artworks/');
    const hasId = urlObj.pathname.match(/\/(\d+)/);
    return isPixiv && hasArtwork && hasId;
  } catch {
    return false;
  }
}

/**
 * Get artwork ID from URL
 */
export function getArtworkId(url) {
  const match = url.match(/artworks\/(\d+)/);
  return match ? match[1] : null;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Download Pixiv artwork using best-effort strategy
 */
export async function downloadPixivMedia(artworkUrl, options = {}) {
  const {
    downloadDir = path.join(__dirname, '../../downloads'),
    timeout = 180000,
    cookies = null
  } = options;

  console.log(`[Pixiv] Starting download for: ${artworkUrl.substring(0, 80)}...`);

  // Validate URL
  if (!isValidPixivUrl(artworkUrl)) {
    return {
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        reason: 'Invalid Pixiv URL format',
        suggestions: ['Use format: https://www.pixiv.net/en/artworks/12345678']
      }
    };
  }

  // Skip cookies for now - pixiv API may require special handling
  // The artwork can be downloaded without auth for public works
  const cookieString = null;
  console.log(`[Pixiv] Proceeding without authentication`);

  // Try strategies in sequence
  const strategies = [
    { name: 'Pixiv API', fn: () => strategyPixivApi(artworkUrl, { ...options, cookies: cookieString }) },
    { name: 'HTML Parsing', fn: () => strategyHtmlParsing(artworkUrl, { ...options, cookies: cookieString }) },
    { name: 'Direct Download', fn: () => strategyDirectDownload(artworkUrl, { ...options, cookies: cookieString }) }
  ];

  for (const strategy of strategies) {
    console.log(`\n[Pixiv] === Strategy: ${strategy.name} ===`);
    const result = await strategy.fn();

    if (result.success) {
      console.log(`[Pixiv] SUCCESS with ${strategy.name}`);
      return {
        success: true,
        strategyUsed: result.strategy,
        data: result.data,
        metadata: result.metadata
      };
    }
  }

  // All strategies failed
  console.log(`\n[Pixiv] ALL STRATEGIES FAILED`);

  return {
    success: false,
    error: {
      type: 'DOWNLOAD_FAILED',
      reason: 'Could not download Pixiv artwork. The artwork may be private, deleted, or require login.',
      suggestions: [
        'Ensure the artwork is publicly accessible',
        'Verify the artwork ID is correct',
        'The artwork may have been deleted or made private',
        'Try logging in and exporting fresh cookies'
      ]
    }
  };
}

/**
 * Parse Netscape cookie file format - extract only essential cookies
 */
async function parseCookieFile(content) {
  const essentialCookies = ['PHPSESSID', 'device_token', 'privacy_policy_agreement', 'first_visit_datetime_pc', 'p_ab_id', 'p_ab_id_2'];
  const cookies = [];

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split('\t');
    if (parts.length >= 7) {
      const name = parts[5];
      const value = parts[6];

      // Only include essential cookies that are safe
      if (essentialCookies.includes(name) && value && value.length > 0) {
        cookies.push(`${name}=${value}`);
      }
    }
  }

  return cookies.join('; ');
}

export default {
  downloadPixivMedia,
  isValidPixivUrl,
  getArtworkId
};
