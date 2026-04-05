import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REDDIT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Enhanced Reddit Service - Best-Effort Forced Downloader
 * Tries multiple strategies in sequence until success or all fail
 */

// ============================================================================
// STRATEGY 1: JSON Extraction (Primary)
// ============================================================================

/**
 * Strategy 1: Extract media from Reddit's .json endpoint
 * Most reliable method for Reddit-hosted media
 */
async function strategyJsonExtraction(postUrl, options = {}) {
  const { maxRetries = 3 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Reddit-Strategy1] Attempt ${attempt}/${maxRetries}: JSON extraction`);

      // Get JSON URL
      const urlObj = new URL(postUrl);
      urlObj.search = ''; // Remove query params
      const jsonUrl = `${urlObj.href}.json`;

      const response = await axios.get(jsonUrl, {
        headers: {
          'User-Agent': REDDIT_UA,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.reddit.com/'
        },
        timeout: 15000,
        maxRedirects: 5
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('Empty response from Reddit JSON API');
      }

      // Parse media from response
      const parseResult = parseRedditJsonForMedia(response.data);

      if (parseResult.mediaUrls && parseResult.mediaUrls.length > 0) {
        console.log(`[Reddit-Strategy1] SUCCESS: Found ${parseResult.mediaUrls.length} media items`);

        // Download first media item
        const media = parseResult.mediaUrls[0];
        const downloaded = await downloadMediaItem(media, postUrl, options);

        if (downloaded) {
          return {
            success: true,
            strategy: 'json_extraction',
            attempt,
            data: downloaded,
            metadata: parseResult
          };
        }
      }

      console.log(`[Reddit-Strategy1] No media found, continuing to next strategy...`);

    } catch (error) {
      console.log(`[Reddit-Strategy1] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, strategy: 'json_extraction' };
}

// ============================================================================
// STRATEGY 2: HTML Parsing (Fallback 1)
// ============================================================================

/**
 * Strategy 2: Parse Reddit HTML page for embedded media data
 * Uses axios to fetch HTML and extract JSON-LD data
 */
async function strategyHtmlParsing(postUrl, options = {}) {
  const { maxRetries = 2 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Reddit-Strategy2] Attempt ${attempt}/${maxRetries}: HTML parsing`);

      const response = await axios.get(postUrl, {
        headers: {
          'User-Agent': REDDIT_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 20000,
        maxRedirects: 5
      });

      const html = response.data;

      // Extract JSON-LD data from HTML
      const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);

      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1]);

          // Look for image or video content
          const mediaUrl = jsonLd.image || jsonLd.contentUrl || jsonLd.url;

          if (mediaUrl) {
            console.log(`[Reddit-Strategy2] Found media URL in JSON-LD: ${mediaUrl.substring(0, 80)}...`);

            const media = {
              url: mediaUrl,
              type: mediaUrl.includes('v.redd.it') ? 'video' :
                    mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image' : 'unknown'
            };

            const downloaded = await downloadMediaItem(media, postUrl, options);

            if (downloaded) {
              return {
                success: true,
                strategy: 'html_parsing',
                attempt,
                data: downloaded,
                metadata: { source: 'json-ld', originalUrl: postUrl }
              };
            }
          }
        } catch (parseError) {
          console.log(`[Reddit-Strategy2] JSON-LD parse error: ${parseError.message}`);
        }
      }

      // Alternative: Extract from window._sharedData (old Reddit embeds)
      const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.*?});<\/script>/);
      if (sharedDataMatch) {
        try {
          const sharedData = JSON.parse(sharedDataMatch[1]);
          const posts = sharedData?.posts || [];

          for (const post of posts) {
            if (post?.media?.reddit_video?.fallback_url) {
              const media = {
                url: post.media.reddit_video.fallback_url,
                type: 'video',
                width: post.media.reddit_video.width,
                height: post.media.reddit_video.height
              };

              const downloaded = await downloadMediaItem(media, postUrl, options);

              if (downloaded) {
                return {
                  success: true,
                  strategy: 'html_parsing',
                  attempt,
                  data: downloaded,
                  metadata: { source: 'shared_data', originalUrl: postUrl }
                };
              }
            }
          }
        } catch (e) {
          // Ignore shared data parse errors
        }
      }

      console.log(`[Reddit-Strategy2] No media found in HTML, continuing...`);

    } catch (error) {
      console.log(`[Reddit-Strategy2] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = Math.min(1500 * Math.pow(2, attempt) + Math.random() * 500, 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, strategy: 'html_parsing' };
}

// ============================================================================
// STRATEGY 3: Direct URL Probing (Fallback 2)
// ============================================================================

/**
 * Strategy 3: Probe the post URL directly and follow redirects
 * Useful for external media links or redirected content
 */
async function strategyDirectProbe(postUrl, options = {}) {
  const { maxRetries = 2 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Reddit-Strategy3] Attempt ${attempt}/${maxRetries}: Direct probe`);

      const response = await axios.get(postUrl, {
        headers: {
          'User-Agent': REDDIT_UA,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000,
        maxRedirects: 10,
        validateStatus: (status) => status < 500
      });

      // Check if we got redirected to a direct media URL
      const finalUrl = response.request?.res?.responseUrl || postUrl;

      if (finalUrl !== postUrl) {
        console.log(`[Reddit-Strategy3] Redirected to: ${finalUrl.substring(0, 80)}...`);

        // Check if it's a direct media URL
        const isMediaUrl = finalUrl.match(/\.(mp4|webm|mov|jpg|jpeg|png|gif|webp)(\?.*)?$/i) ||
                          finalUrl.includes('i.redd.it') ||
                          finalUrl.includes('v.redd.it') ||
                          finalUrl.includes('preview.redd.it');

        if (isMediaUrl) {
          const media = {
            url: finalUrl,
            type: finalUrl.includes('v.redd.it') ? 'video' : 'image'
          };

          const downloaded = await downloadMediaItem(media, postUrl, options);

          if (downloaded) {
            return {
              success: true,
              strategy: 'direct_probe',
              attempt,
              data: downloaded,
              metadata: { source: 'redirect', originalUrl: postUrl, finalUrl }
            };
          }
        }
      }

      // Check response headers for media info
      const contentType = response.headers['content-type'] || '';
      const contentLength = response.headers['content-length'];

      if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
        console.log(`[Reddit-Strategy3] Direct media response: ${contentType}`);

        const media = {
          url: postUrl,
          type: contentType.startsWith('video/') ? 'video' : 'image',
          headers: { 'Content-Type': contentType }
        };

        const downloaded = await downloadMediaItem(media, postUrl, options);

        if (downloaded) {
          return {
            success: true,
            strategy: 'direct_probe',
            attempt,
            data: downloaded,
            metadata: { source: 'direct_response', contentType, contentLength }
          };
        }
      }

      console.log(`[Reddit-Strategy3] No direct media found, continuing...`);

    } catch (error) {
      console.log(`[Reddit-Strategy3] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * attempt + Math.random() * 300, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, strategy: 'direct_probe' };
}

// ============================================================================
// STRATEGY 4: yt-dlp Fallback (Last Resort)
// ============================================================================

/**
 * Strategy 4: Use yt-dlp as last resort
 * Best chance for DRM-protected or complex media
 */
async function strategyYtDlpFallback(postUrl, options = {}) {
  const { maxRetries = 2, downloadDir = path.join(__dirname, '../../downloads') } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Reddit-Strategy4] Attempt ${attempt}/${maxRetries}: yt-dlp fallback`);

      // Ensure download directory exists
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      const timestamp = Date.now();
      // Use forward slashes for yt-dlp on Windows
      const outputTemplate = path.join(downloadDir, `reddit_%(title)s_${timestamp}.%(ext)s`).replace(/\\/g, '/');

      // yt-dlp command with forced download options
      const command = [
        'yt-dlp',
        '--no-check-certificate',
        '--no-check-formats',
        '--force-overwrites',
        '--no-continue',
        '--no-part',
        '--output', outputTemplate,
        '--format', 'best[height<=1080]/best',
        '--user-agent', REDDIT_UA,
        '--extractor-args', 'Reddit:all',
        '--socket-timeout', '30',
        '--retries', '3',
        '--fragment-retries', '3',
        '--no-abort-on-error',
        '--ignore-no-formats-error',
        postUrl
      ].join(' ');

      console.log(`[Reddit-Strategy4] Executing: yt-dlp ${postUrl.substring(0, 50)}...`);

      const { stdout, stderr } = await execAsync(command, {
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024 // 50MB
      });

      console.log(`[Reddit-Strategy4] yt-dlp output: ${stdout.substring(0, 500)}`);

      // Find downloaded file
      const files = fs.readdirSync(downloadDir);

      const redditFiles = files.filter(f =>
        f.startsWith('reddit_') && f.includes(String(timestamp))
      );

      if (redditFiles.length > 0) {
        const filename = redditFiles[0];
        const filepath = path.join(downloadDir, filename);
        const stat = fs.statSync(filepath);

        console.log(`[Reddit-Strategy4] SUCCESS: Downloaded ${filename} (${stat.size} bytes)`);

        return {
          success: true,
          strategy: 'yt_dlp_fallback',
          attempt,
          data: {
            filename,
            filepath: filename,
            size: stat.size,
            originalUrl: postUrl
          },
          metadata: { source: 'yt-dlp', stdout }
        };
      }

    } catch (error) {
      console.log(`[Reddit-Strategy4] Attempt ${attempt} failed: ${error.message}`);

      if (error.code === 'ETIMEDOUT' || error.killed) {
        console.log(`[Reddit-Strategy4] Timeout, skipping remaining retries`);
        break;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(2000 * attempt + Math.random() * 500, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, strategy: 'yt_dlp_fallback' };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse Reddit JSON to extract all media URLs
 */
export function parseRedditJsonForMedia(jsonData) {
  const mediaUrls = [];
  const postType = jsonData[0]?.data?.children[0]?.data?.post_hint || 'text';

  const post = jsonData[0]?.data?.children[0]?.data;
  if (!post) {
    return { mediaUrls: [], postType: 'unknown', error: 'Could not parse Reddit post data' };
  }

  // Handle Reddit-hosted video
  if (post.media?.reddit_video) {
    const video = post.media.reddit_video;
    if (video.fallback_url) {
      mediaUrls.push({
        url: video.fallback_url,
        type: 'video',
        width: video.width,
        height: video.height,
        dashUrl: video.dash_url,
        hlsUrl: video.hls_url
      });
    }
  }

  // Handle preview images
  if (post.preview?.images) {
    for (const img of post.preview.images) {
      if (img.source?.url) {
        const decodedUrl = decodeURIComponent(img.source.url);
        mediaUrls.push({
          url: decodedUrl,
          type: 'image',
          width: img.source.width,
          height: img.source.height
        });
      }
    }
  }

  // Handle galleries
  if (post.gallery_data && post.media_metadata) {
    for (const item of post.gallery_data.items || []) {
      const mediaId = item.media_id;
      const metadata = post.media_metadata[mediaId];
      if (metadata?.s?.u) {
        mediaUrls.push({
          url: metadata.s.u,
          type: 'image',
          galleryIndex: item.outbound_gallery_index
        });
      } else if (metadata?.p?.[0]?.u) {
        mediaUrls.push({
          url: metadata.p[0].u,
          type: 'image',
          galleryIndex: item.outbound_gallery_index
        });
      }
    }
  }

  // Handle crossposts
  if (post.crosspost_parent_list && post.crosspost_parent_list.length > 0) {
    const parentPost = post.crosspost_parent_list[0];
    const parentMedia = parseRedditJsonForMedia([{ data: { children: [{ data: parentPost }] } }]);
    mediaUrls.push(...parentMedia.mediaUrls);
  }

  // Handle external links
  if (post.url && !post.url.includes('reddit.com') &&
      (post.url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i) ||
       post.url.includes('i.redd.it') || post.url.includes('v.redd.it'))) {
    mediaUrls.push({
      url: post.url,
      type: post.url.includes('v.redd.it') ? 'video' : 'image',
      isExternal: true
    });
  }

  return {
    mediaUrls,
    postType,
    title: post.title,
    author: post.author,
    subreddit: post.subreddit,
    isGallery: !!post.gallery_data,
    isVideo: !!post.media?.reddit_video,
    isImage: post.preview?.images?.length > 0
  };
}

/**
 * Download a single media item
 */
async function downloadMediaItem(media, originalUrl, options = {}) {
  const { downloadDir = path.join(__dirname, '../../downloads') } = options;

  try {
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const ext = media.type === 'video' ? 'mp4' : 'jpg';
    const filename = `reddit_${Date.now()}.${ext}`;
    const filepath = path.join(downloadDir, filename);

    console.log(`[Reddit-Download] Fetching: ${media.url.substring(0, 80)}...`);

    const response = await axios({
      url: media.url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': REDDIT_UA,
        'Accept': '*/*',
        'Referer': 'https://www.reddit.com/'
      },
      timeout: 60000
    });

    const writer = fs.createWriteStream(filepath);

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const stat = fs.statSync(filepath);
    console.log(`[Reddit-Download] Saved: ${filename} (${stat.size} bytes)`);

    return {
      filename,
      filepath: filename,
      size: stat.size,
      type: media.type,
      originalUrl
    };

  } catch (error) {
    console.log(`[Reddit-Download] Failed: ${error.message}`);
    return null;
  }
}

/**
 * Validate Reddit URL
 */
export function isValidRedditUrl(url) {
  try {
    const urlObj = new URL(url);
    const isReddit = urlObj.hostname.includes('reddit.com');
    const hasPath = urlObj.pathname.match(/\/r\/\w+\/comments\//);
    const hasPostId = urlObj.pathname.split('/').length >= 6;
    return isReddit && hasPath && hasPostId;
  } catch {
    return false;
  }
}

/**
 * Get JSON URL from post URL
 */
export function getJsonUrl(postUrl) {
  const urlObj = new URL(postUrl);
  urlObj.search = '';
  return `${urlObj.href}.json`;
}

// ============================================================================
// MAIN FUNCTION: Best-Effort Forced Downloader
// ============================================================================

/**
 * Download Reddit Media - Best-Effort Forced Downloader
 * Tries multiple strategies in sequence until success or all fail
 * Returns ERR_FORCE_DOWNLOAD_FAILED only after ALL strategies exhausted
 */
export async function downloadRedditMediaForce(postUrl, options = {}) {
  const {
    downloadDir = path.join(__dirname, '../../downloads'),
    timeout = 180000
  } = options;

  console.log(`[Reddit-Force] Starting best-effort download for: ${postUrl.substring(0, 80)}...`);

  // Validate URL
  if (!isValidRedditUrl(postUrl)) {
    return {
      success: false,
      error: {
        code: 'ERR_FORCE_DOWNLOAD_FAILED',
        type: 'VALIDATION_ERROR',
        reason: 'Invalid Reddit URL format',
        suggestions: ['Use format: https://www.reddit.com/r/subreddit/comments/post_id/post_title/']
      }
    };
  }

  const strategyResults = [];
  let lastError = null;

  // Strategy 1: JSON Extraction
  console.log(`\n[Reddit-Force] === Strategy 1: JSON Extraction ===`);
  const jsonResult = await strategyJsonExtraction(postUrl, options);
  strategyResults.push(jsonResult);

  if (jsonResult.success) {
    console.log(`[Reddit-Force] ✓ SUCCESS with Strategy 1 (JSON Extraction)`);
    return {
      success: true,
      strategyUsed: 'json_extraction',
      data: jsonResult.data,
      metadata: jsonResult.metadata
    };
  }

  lastError = jsonResult.error;

  // Strategy 2: HTML Parsing
  console.log(`\n[Reddit-Force] === Strategy 2: HTML Parsing ===`);
  const htmlResult = await strategyHtmlParsing(postUrl, options);
  strategyResults.push(htmlResult);

  if (htmlResult.success) {
    console.log(`[Reddit-Force] ✓ SUCCESS with Strategy 2 (HTML Parsing)`);
    return {
      success: true,
      strategyUsed: 'html_parsing',
      data: htmlResult.data,
      metadata: htmlResult.metadata
    };
  }

  lastError = htmlResult.error;

  // Strategy 3: Direct Probe
  console.log(`\n[Reddit-Force] === Strategy 3: Direct Probe ===`);
  const probeResult = await strategyDirectProbe(postUrl, options);
  strategyResults.push(probeResult);

  if (probeResult.success) {
    console.log(`[Reddit-Force] ✓ SUCCESS with Strategy 3 (Direct Probe)`);
    return {
      success: true,
      strategyUsed: 'direct_probe',
      data: probeResult.data,
      metadata: probeResult.metadata
    };
  }

  lastError = probeResult.error;

  // Strategy 4: yt-dlp Fallback
  console.log(`\n[Reddit-Force] === Strategy 4: yt-dlp Fallback ===`);
  const ytdlpResult = await strategyYtDlpFallback(postUrl, { ...options, downloadDir });
  strategyResults.push(ytdlpResult);

  if (ytdlpResult.success) {
    console.log(`[Reddit-Force] ✓ SUCCESS with Strategy 4 (yt-dlp)`);
    return {
      success: true,
      strategyUsed: 'yt_dlp_fallback',
      data: ytdlpResult.data,
      metadata: ytdlpResult.metadata
    };
  }

  lastError = ytdlpResult.error;

  // All strategies failed - Return ERR_FORCE_DOWNLOAD_FAILED
  console.log(`\n[Reddit-Force] ✗ ALL STRATEGIES FAILED`);
  console.log(`[Reddit-Force] Error Code: ERR_FORCE_DOWNLOAD_FAILED`);

  return {
    success: false,
    error: {
      code: 'ERR_FORCE_DOWNLOAD_FAILED',
      type: 'FORCE_DOWNLOAD_FAILED',
      reason: 'All download strategies exhausted. Media may be unavailable, deleted, or restricted.',
      strategiesAttempted: [
        { name: 'json_extraction', success: jsonResult.success },
        { name: 'html_parsing', success: htmlResult.success },
        { name: 'direct_probe', success: probeResult.success },
        { name: 'yt_dlp_fallback', success: ytdlpResult.success }
      ],
      suggestions: [
        'Check if the Reddit post exists and is publicly accessible',
        'Verify the post is not deleted or removed',
        'Ensure the post contains media (text-only posts have nothing to download)',
        'Try again later - Reddit may be experiencing temporary issues',
        'The content may be region-restricted or require authentication'
      ],
      lastError: lastError?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    },
    strategyResults
  };
}

/**
 * Simple Reddit download (legacy function - uses JSON only)
 */
export async function downloadRedditMedia(postUrl, options = {}) {
  return strategyJsonExtraction(postUrl, options);
}

export default {
  downloadRedditMedia,
  downloadRedditMediaForce,
  isValidRedditUrl,
  getJsonUrl,
  parseRedditJsonForMedia
};
