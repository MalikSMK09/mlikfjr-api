/**
 * Multi-Platform Media Downloader v2.0
 * Full integration of: play-dl, instagram-private-api, twitter-api-v2, tiktok-scraper
 *
 * Usage: node multi-platform-media-downloader.cjs <url>
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Package imports
let playdl;
try { playdl = require('play-dl'); } catch (e) { playdl = null; }
let InstagramApi;
let TwitterApi;
let TikTokScraper;

try { InstagramApi = require('instagram-private-api'); } catch (e) { InstagramApi = null; }
try { TwitterApi = require('twitter-api-v2').TwitterApi; } catch (e) { TwitterApi = null; }
try {
  TikTokScraper = require('tiktok-scraper');
} catch (e) {
  try { TikTokScraper = require('@prevter/tiktok-scraper'); } catch (e2) { TikTokScraper = null; }
}

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'downloads');
const TIMEOUT = 60000;

// Cookie files
const COOKIES = {
  twitter: path.join(__dirname, '..', 'cookies', 'twitter.txt'),
  instagram: path.join(__dirname, '..', 'cookies', 'instagram.txt'),
  facebook: path.join(__dirname, '..', 'cookies', 'facebook.txt'),
  tiktok: path.join(__dirname, '..', 'cookies', 'tiktok.txt')
};

// Proxy configuration (optional - set your proxy here)
const PROXY = {
  enabled: false,
  url: 'http://IP_PROXY:PORT',
  useEnv: true,
  envKey: 'TIKTOK_PROXY',
  // Use random proxy from file
  useFile: true,
  proxyFile: path.join(__dirname, '..', 'proxy.txt'),
  maxRetries: 3
};

// Cache for proxy list
let proxyList = null;

/**
 * Load proxy list from file
 */
function loadProxyList() {
  if (proxyList) return proxyList;
  try {
    if (fs.existsSync(PROXY.proxyFile)) {
      const content = fs.readFileSync(PROXY.proxyFile, 'utf-8');
      proxyList = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && l.length > 5)
        .map(l => {
          // Add http:// if not present
          if (!l.startsWith('http://') && !l.startsWith('https://')) {
            // If no port, add default 8080
            if (!l.includes(':')) {
              l = `${l}:8080`;
            }
            return `http://${l}`;
          }
          return l;
        });
      console.log(`  ℹ Loaded ${proxyList.length} proxies from file`);
    }
  } catch (e) {
    proxyList = [];
  }
  return proxyList || [];
}

/**
 * Get random proxy from file
 */
function getRandomProxy() {
  const proxies = loadProxyList();
  if (proxies.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * proxies.length);
  return proxies[randomIndex];
}

/**
 * Get proxy URL (priority: env > file > config)
 */
function getProxyUrl() {
  if (PROXY.useEnv && process.env[PROXY.envKey]) {
    return process.env[PROXY.envKey];
  }
  if (PROXY.useFile && !PROXY.enabled) {
    return getRandomProxy();
  }
  return PROXY.enabled ? PROXY.url : null;
}

/**
 * Read cookie file in Netscape format
 */
function readCookieFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const cookies = lines.map(line => {
      const parts = line.split('\t');
      if (parts.length >= 7) {
        const name = parts[5];
        let value = parts[6];
        value = value.replace(/\\[0-7]{3}/g, (match) => String.fromCharCode(parseInt(match.slice(1), 8)));
        value = value.replace(/["\r\n]/g, '');
        return `${name}=${value}`;
      }
      return null;
    }).filter(Boolean);
    return cookies.join('; ');
  } catch { return null; }
}

/**
 * Platform detection
 */
function detectPlatform(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('x.com') || urlLower.includes('twitter.com')) return 'twitter';
  if (urlLower.includes('instagram.com')) return 'instagram';
  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) return 'facebook';
  if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) return 'pinterest';
  if (urlLower.includes('reddit.com')) return 'reddit';
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('spotify.com') || urlLower.includes('open.spotify.com')) return 'spotify';
  return 'unknown';
}

/**
 * Download file
 */
async function downloadFile(url, filepath, description) {
  console.log(`  ↓ Downloading: ${description}`);
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      responseType: 'stream',
      timeout: TIMEOUT,
      maxRedirects: 10
    });
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        const size = fs.statSync(filepath).size;
        console.log(`  ✓ Saved: ${path.basename(filepath)} (${formatBytes(size)})`);
        resolve({ success: true, size });
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.log(`  ✗ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Download with yt-dlp
 */
async function downloadWithYtDlp(url, filepath, platform) {
  console.log(`  ↓ Downloading: ${path.basename(filepath)}`);
  const cookieFile = COOKIES[platform];
  const cookieArg = cookieFile && fs.existsSync(cookieFile) ? `--cookies "${cookieFile}"` : '';
  const command = `yt-dlp ${cookieArg} -o "${filepath.replace(/\\/g, '/')}" --no-part --no-mtime --format best "${url}"`;
  try {
    execSync(command, { encoding: 'utf-8', timeout: 180000 });
    if (fs.existsSync(filepath)) {
      const size = fs.statSync(filepath).size;
      console.log(`  ✓ Saved: ${path.basename(filepath)} (${formatBytes(size)})`);
      return { success: true, size };
    }
    // Find downloaded file
    const dir = path.dirname(filepath);
    const base = path.basename(filepath, path.extname(filepath));
    const files = fs.readdirSync(dir).filter(f => f.startsWith(base));
    if (files.length > 0) {
      fs.renameSync(path.join(dir, files[0]), filepath);
      const size = fs.statSync(filepath).size;
      console.log(`  ✓ Saved: ${path.basename(filepath)} (${formatBytes(size)})`);
      return { success: true, size };
    }
  } catch (error) {
    console.log(`  ✗ Failed: ${error.message}`);
  }
  return { success: false };
}

/**
 * ============================================================
 * TWITTER/X - Using twitter-api-v2 + yt-dlp fallback
 * ============================================================
 */
async function extractTwitterMedia(url) {
  console.log('\n🐦 Platform: Twitter/X');
  console.log('🔍 Fetching tweet data...');

  // Method 1: Use twitter-api-v2 if available
  if (TwitterApi) {
    try {
      console.log('  ℹ Using twitter-api-v2...');
      const tweetId = url.match(/status[/:](\d+)/)?.[1];
      if (tweetId) {
        // Get bearer token from cookies or use public access
        const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN || '');
        const tweet = await client.v2.singleTweet(tweetId, {
          'tweet.fields': ['attachments', 'public_metrics'],
          expansions: ['attachments.media_keys'],
          'media.fields': ['type', 'url', 'width', 'height', 'preview_image_url']
        });

        if (tweet.data && tweet.includes?.media) {
          const mediaItems = [];
          for (const media of tweet.includes.media) {
            if (media.type === 'video' || media.type === 'animated_gif') {
              // Get highest quality video variant
              const variants = media.video_info?.variants || [];
              const videoVariant = variants.find(v => v.content_type === 'video/mp4') || variants[0];
              if (videoVariant) {
                mediaItems.push({
                  type: media.type === 'animated_gif' ? 'animated_gif' : 'video',
                  url: videoVariant.url,
                  extension: 'mp4',
                  width: media.width,
                  height: media.height,
                  description: `${media.type} ${media.width}x${media.height}`
                });
              }
            } else if (media.type === 'photo') {
              mediaItems.push({
                type: 'photo',
                url: media.url || media.preview_image_url,
                extension: 'jpg',
                width: media.width,
                height: media.height
              });
            }
          }
          if (mediaItems.length > 0) {
            console.log(`  ✓ Found ${mediaItems.length} media via twitter-api-v2`);
            return {
              platform: 'twitter',
              title: tweet.data.text?.substring(0, 100) || 'Twitter Post',
              uploader: tweet.includes.users?.[0]?.username || 'Unknown',
              description: tweet.data.text || '',
              mediaItems
            };
          }
        }
      }
    } catch (apiError) {
      console.log(`  ⚠ twitter-api-v2 failed: ${apiError.message.substring(0, 50)}`);
    }
  }

  // Method 2: Fallback to yt-dlp
  console.log('  ℹ Using yt-dlp...');
  try {
    const cookieFile = COOKIES.twitter;
    const cookieArg = cookieFile && fs.existsSync(cookieFile) ? `--cookies "${cookieFile}"` : '';
    const jsonOutput = execSync(
      `yt-dlp ${cookieArg} --dump-json --no-download "${url}"`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    const data = JSON.parse(jsonOutput.trim());
    const mediaItems = [];

    // Get best video
    if (data.formats?.length > 0) {
      const videoFormats = data.formats.filter(f => f.vcodec && f.vcodec !== 'none' && f.ext === 'mp4');
      if (videoFormats.length > 0) {
        const bestVideo = videoFormats.sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0))[0];
        mediaItems.push({
          type: 'video',
          url: bestVideo.url,
          extension: 'mp4',
          width: bestVideo.width,
          height: bestVideo.height,
          description: `Video ${bestVideo.width}x${bestVideo.height}`
        });
      }
    }

    // Get photos
    const mediaEntities = data.entities?.media || data.extended_entities?.media || [];
    for (const item of mediaEntities) {
      if (item.type === 'photo') {
        let imgUrl = item.media_url_https;
        if (item.sizes?.large) imgUrl += ':large';
        mediaItems.push({ type: 'photo', url: imgUrl, extension: 'jpg', alt: item.alt_text });
      }
    }

    // Thumbnail fallback
    if (mediaItems.length === 0 && data.thumbnail?.includes('twimg.com')) {
      mediaItems.push({ type: 'photo', url: data.thumbnail, extension: 'jpg', description: 'Thumbnail' });
    }

    if (mediaItems.length > 0) {
      console.log(`  ✓ Found ${mediaItems.length} media via yt-dlp`);
      return { platform: 'twitter', title: data.title, uploader: data.uploader, description: data.description || data.title, mediaItems };
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
  }

  return { platform: 'twitter', mediaItems: [], error: 'Failed to fetch Twitter media' };
}

/**
 * ============================================================
 * INSTAGRAM - Using instagram-private-api + yt-dlp fallback
 * ============================================================
 */
async function extractInstagramMedia(url) {
  console.log('\n📸 Platform: Instagram');
  console.log('🔍 Fetching post data...');

  // Method 1: Use instagram-private-api if available
  if (InstagramApi) {
    try {
      console.log('  ℹ Using instagram-private-api...');
      const cookieFile = COOKIES.instagram;
      if (cookieFile && fs.existsSync(cookieFile)) {
        const cookie = readCookieFile(cookieFile);
        const device = new InstagramApi.Device('Windows');
        const session = new InstagramApi.Session(device, cookie);

        const result = await session.fetchMedia(url);
        if (result) {
          const mediaItems = [];
          const items = result.items || [result];

          for (const item of items) {
            const imageVersions2 = item.image_versions2 || item.media?.image_versions2;
            const videoVersions = item.video_versions || item.media?.video_versions;
            const candidates = imageVersions2?.candidates || [];

            // Get highest quality image
            if (candidates.length > 0) {
              candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));
              const best = candidates[0];
              mediaItems.push({
                type: 'photo',
                url: best.url,
                extension: 'jpg',
                width: best.width,
                height: best.height,
                description: `Photo ${best.width}x${best.height}`
              });
            }

            // Get video if available
            if (videoVersions?.length > 0) {
              videoVersions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
              const bestVideo = videoVersions[0];
              mediaItems.push({
                type: 'video',
                url: bestVideo.url,
                extension: 'mp4',
                width: bestVideo.width,
                height: bestVideo.height,
                description: `Video ${bestVideo.width}x${bestVideo.height}`
              });
            }
          }

          if (mediaItems.length > 0) {
            console.log(`  ✓ Found ${mediaItems.length} media via instagram-private-api`);
            return {
              platform: 'instagram',
              title: result.caption?.text?.substring(0, 100) || 'Instagram Post',
              uploader: result.user?.username || 'Unknown',
              description: result.caption?.text || '',
              mediaItems
            };
          }
        }
      }
    } catch (apiError) {
      console.log(`  ⚠ instagram-private-api failed: ${apiError.message.substring(0, 60)}`);
    }
  }

  // Method 2: Fallback to yt-dlp
  console.log('  ℹ Using yt-dlp...');
  try {
    const cookieFile = COOKIES.instagram;
    const cookieArg = cookieFile && fs.existsSync(cookieFile) ? `--cookies "${cookieFile}"` : '';
    const jsonOutput = execSync(
      `yt-dlp ${cookieArg} --dump-json --no-download "${url}"`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    const data = JSON.parse(jsonOutput.trim());
    const mediaItems = [];

    // Get video
    if (data.formats?.length > 0) {
      const videoFormats = data.formats.filter(f => f.vcodec && f.vcodec !== 'none' && f.ext === 'mp4');
      if (videoFormats.length > 0) {
        const bestVideo = videoFormats.sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0))[0];
        mediaItems.push({
          type: 'video',
          url: bestVideo.url,
          extension: 'mp4',
          width: bestVideo.width,
          height: bestVideo.height,
          description: 'Video'
        });
      }
    }

    // Get carousel images (high quality)
    if (data.formats?.length > 1) {
      const imageFormats = data.formats.filter(f =>
        f.ext && ['jpg', 'jpeg', 'png', 'webp'].includes(f.ext.toLowerCase()) &&
        f.width && f.width >= 600
      );
      imageFormats.sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0));
      imageFormats.forEach((fmt, idx) => {
        mediaItems.push({
          type: 'photo',
          url: fmt.url,
          extension: fmt.ext || 'jpg',
          width: fmt.width,
          height: fmt.height,
          description: `Image ${idx + 1}`
        });
      });
    }

    // Thumbnail
    if (mediaItems.length === 0 && data.thumbnail) {
      const thumb = data.thumbnail.replace(/\/s\d+x\d+\//, '/s1080x1080/');
      mediaItems.push({ type: 'photo', url: thumb, extension: 'jpg', description: 'Thumbnail' });
    }

    if (mediaItems.length > 0) {
      console.log(`  ✓ Found ${mediaItems.length} media via yt-dlp`);
      return { platform: 'instagram', title: data.title, uploader: data.uploader, description: data.description || data.title, mediaItems };
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
  }

  return { platform: 'instagram', mediaItems: [], error: 'Failed to fetch Instagram media' };
}

/**
 * ============================================================
 * TIKTOK - Using tiktok-scraper with headers
 * ============================================================
 */
async function extractTikTokMedia(url) {
  console.log('\n🎵 Platform: TikTok');
  console.log('🔍 Fetching video data...');

  // TikTok headers to mimic browser
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.tiktok.com/',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1'
  };

  // Method 1: Use tiktok-scraper with headers
  if (TikTokScraper && TikTokScraper.video) {
    console.log('  ℹ Using tiktok-scraper with headers...');

    try {
      const data = await TikTokScraper.video(url, {
        headers: headers,
        noWaterMark: true,
        timeout: 30000
      });

      console.log('  ℹ Response received, checking data...');
      if (!data) {
        throw new Error('No data returned from tiktok-scraper');
      }

      // Check for various response formats
      const videoUrl = data.videoUrl || data.video || data.url;
      const desc = data.desc || data.description || '';
      const authorName = data.authorMeta?.name || data.authorName || data.author || '';
      const coverUrl = data.coverUrl || data.cover || data.previewImageUrl || data.thumbnail || '';

      if (videoUrl) {
        const mediaItems = [{
          type: 'video',
          url: videoUrl,
          extension: 'mp4',
          width: data.width || 1080,
          height: data.height || 1920,
          description: 'Video HD (No watermark)'
        }];

        if (coverUrl) {
          mediaItems.push({
            type: 'photo',
            url: coverUrl,
            extension: 'jpg',
            description: 'Video thumbnail'
          });
        }

        console.log('  ✓ Found video via tiktok-scraper');
        console.log(`  ℹ Description: ${desc.substring(0, 50) || 'N/A'}...`);
        console.log(`  ℹ Author: ${authorName || 'N/A'}`);

        return {
          platform: 'tiktok',
          title: desc || 'TikTok Video',
          uploader: authorName,
          description: desc || '',
          mediaItems
        };
      }
      console.log('  ⚠ No video URL in response');
    } catch (scraperError) {
      const errMsg = scraperError.message || String(scraperError);
      console.log(`  ⚠ tiktok-scraper failed: ${errMsg.substring(0, 80)}`);
    }
  }

  // Method 2: Try @prevter/tiktok-scraper
  if (TikTokScraper && TikTokScraper.fetchVideo) {
    console.log('  ℹ Trying @prevter/tiktok-scraper...');

    try {
      const video = await TikTokScraper.fetchVideo(url);
      const mediaItems = [{
        type: 'video',
        extension: 'mp4',
        description: 'Video HD',
        width: 1080,
        height: 1920,
        _tiktokVideo: video
      }];

      if (video.previewImageUrl) {
        mediaItems.push({
          type: 'photo',
          url: video.previewImageUrl,
          extension: 'jpg',
          description: 'Video thumbnail'
        });
      }

      console.log('  ✓ Found video via @prevter/tiktok-scraper');
      return {
        platform: 'tiktok',
        title: video.description || 'TikTok Video',
        uploader: video.author || 'Unknown',
        description: video.description || '',
        mediaItems
      };
    } catch (scraperError) {
      console.log(`  ⚠ @prevter/tiktok-scraper failed: ${scraperError.message.substring(0, 80)}`);
    }
  }

  // Method 3: Fallback to yt-dlp
  console.log('  ℹ Using yt-dlp fallback...');
  try {
    const cookieFile = COOKIES.tiktok;
    const cookieArg = cookieFile && fs.existsSync(cookieFile) ? `--cookies "${cookieFile}"` : '';
    const jsonOutput = execSync(
      `yt-dlp ${cookieArg} --dump-json --no-download "${url}"`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    const data = JSON.parse(jsonOutput.trim());
    const mediaItems = [];

    if (data.formats?.length > 0) {
      const videoFormats = data.formats.filter(f => f.vcodec && f.vcodec !== 'none' && (f.ext === 'mp4' || f.ext === 'm4a'));
      if (videoFormats.length > 0) {
        const bestVideo = videoFormats.sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0))[0];
        mediaItems.push({
          type: 'video',
          url: bestVideo.url,
          extension: 'mp4',
          width: bestVideo.width,
          height: bestVideo.height,
          description: `Video ${bestVideo.width || 0}x${bestVideo.height || 0}`
        });
      }
    }

    if (data.thumbnail) {
      mediaItems.push({
        type: 'photo',
        url: data.thumbnail,
        extension: 'jpg',
        description: 'Video thumbnail'
      });
    }

    if (mediaItems.length > 0) {
      console.log(`  ✓ Found ${mediaItems.length} media via yt-dlp`);
      return { platform: 'tiktok', title: data.title, uploader: data.uploader, description: data.description || data.title, mediaItems };
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message.substring(0, 80)}`);
  }

  return {
    platform: 'tiktok',
    mediaItems: [],
    error: 'TikTok download failed. Try again later.'
  };
}

/**
 * ============================================================
 * YOUTUBE - Using play-dl + yt-dlp hybrid (best approach)
 * ============================================================
 */
async function extractYouTubeMedia(url) {
  console.log('\n▶ Platform: YouTube');
  console.log('🔍 Fetching video data...');

  try {
    // Method 1: play-dl for fast metadata
    if (playdl) {
      console.log('  ℹ Getting info with play-dl...');
      const videoInfo = await playdl.video_info(url);
      const data = videoInfo.video_details;

      console.log(`  ✓ Title: ${data.title}`);
      console.log(`  ✓ Channel: ${data.channel?.name || data.uploader}`);
    }

    // Method 2: yt-dlp for reliable format selection
    console.log('  ℹ Getting formats with yt-dlp...');
    const jsonOutput = execSync(
      `yt-dlp --dump-json --no-download "${url}"`,
      { encoding: 'utf-8', timeout: 60000 }
    );

    const ytData = JSON.parse(jsonOutput.trim());
    const mediaItems = [];

    // Find best merged format (video + audio)
    if (ytData.formats?.length > 0) {
      const mergedFormats = ytData.formats.filter(f =>
        f.vcodec && f.vcodec !== 'none' &&
        f.acodec && f.acodec !== 'none' &&
        f.ext === 'mp4'
      );

      if (mergedFormats.length > 0) {
        mergedFormats.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
        const best = mergedFormats[0];
        mediaItems.push({
          type: 'video',
          url: best.url,
          extension: 'mp4',
          width: best.width || 1920,
          height: best.height || 1080,
          description: `Video ${best.width}x${best.height} (merged)`
        });
        console.log(`  ✓ Best format: ${best.width}x${best.height}`);
      } else {
        // Fallback to video-only
        const videoFormats = ytData.formats.filter(f => f.vcodec && f.vcodec !== 'none' && f.ext === 'mp4');
        if (videoFormats.length > 0) {
          videoFormats.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
          const best = videoFormats[0];
          mediaItems.push({
            type: 'video',
            url: best.url,
            extension: 'mp4',
            width: best.width || 1920,
            height: best.height || 1080,
            description: `Video ${best.width}x${best.height}`
          });
        }
      }
    }

    // Add thumbnail
    if (ytData.thumbnail) {
      mediaItems.push({
        type: 'photo',
        url: ytData.thumbnail,
        extension: 'jpg',
        description: 'Video thumbnail'
      });
    }

    if (mediaItems.length > 0) {
      return {
        platform: 'youtube',
        title: ytData.title,
        uploader: ytData.uploader,
        description: ytData.description || ytData.title,
        mediaItems
      };
    }

    throw new Error('No formats found');
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    return { platform: 'youtube', mediaItems: [], error: error.message };
  }
}

/**
 * ============================================================
 * FACEBOOK - Using yt-dlp
 * ============================================================
 */
async function extractFacebookMedia(url) {
  console.log('\n📘 Platform: Facebook');
  console.log('🔍 Fetching post data...');

  try {
    const cookieFile = COOKIES.facebook;
    const cookieArg = cookieFile && fs.existsSync(cookieFile) ? `--cookies "${cookieFile}"` : '';
    const jsonOutput = execSync(
      `yt-dlp ${cookieArg} --dump-json --no-download "${url}"`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    const data = JSON.parse(jsonOutput.trim());
    const mediaItems = [];

    if (data.formats?.length > 0) {
      const videoFormats = data.formats.filter(f => f.vcodec && f.vcodec !== 'none' && f.ext === 'mp4');
      if (videoFormats.length > 0) {
        videoFormats.sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0));
        const best = videoFormats[0];
        mediaItems.push({
          type: 'video',
          url: best.url,
          extension: 'mp4',
          width: best.width,
          height: best.height
        });
      }
    }

    if (data.thumbnail) {
      mediaItems.push({ type: 'photo', url: data.thumbnail, extension: 'jpg', description: 'Thumbnail' });
    }

    console.log(`  ✓ Found ${mediaItems.length} media`);
    return { platform: 'facebook', title: data.title, uploader: data.uploader, description: data.description || data.title, mediaItems };
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    return { platform: 'facebook', mediaItems: [], error: error.message };
  }
}

/**
 * Generic extractor for other platforms
 */
async function extractGenericMedia(url, platformName) {
  console.log(`\n📱 Platform: ${platformName}`);
  console.log('🔍 Fetching media data...');

  try {
    const jsonOutput = execSync(
      `yt-dlp --dump-json --no-download "${url}"`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    const data = JSON.parse(jsonOutput.trim());
    const mediaItems = [];

    if (data.formats?.length > 0) {
      const videoFormats = data.formats.filter(f => f.vcodec && f.vcodec !== 'none' && f.ext === 'mp4');
      if (videoFormats.length > 0) {
        videoFormats.sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0));
        const best = videoFormats[0];
        mediaItems.push({
          type: 'video',
          url: best.url,
          extension: 'mp4',
          width: best.width,
          height: best.height
        });
      }
    }

    if (data.thumbnail) {
      mediaItems.push({ type: 'photo', url: data.thumbnail, extension: 'jpg', description: 'Thumbnail' });
    }

    console.log(`  ✓ Found ${mediaItems.length} media`);
    return { platform: platformName.toLowerCase(), title: data.title, uploader: data.uploader, description: data.description || data.title, mediaItems };
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    return { platform: platformName.toLowerCase(), mediaItems: [], error: error.message };
  }
}

/**
 * Main extraction dispatcher
 */
async function extractMedia(url) {
  const platform = detectPlatform(url);

  switch (platform) {
    case 'twitter': return await extractTwitterMedia(url);
    case 'instagram': return await extractInstagramMedia(url);
    case 'tiktok': return await extractTikTokMedia(url);
    case 'facebook': return await extractFacebookMedia(url);
    case 'youtube': return await extractYouTubeMedia(url);
    case 'spotify': return await extractSpotifyMedia(url);
    case 'reddit': return await extractGenericMedia(url, 'Reddit');
    case 'pinterest': return await extractGenericMedia(url, 'Pinterest');
    default: return await extractGenericMedia(url, platform);
  }
}

/**
 * ============================================================
 * SPOTIFY - Using spotdl (Python)
 * ============================================================
 */
async function extractSpotifyMedia(url) {
  console.log('\n🎵 Platform: Spotify');
  console.log('🔍 Fetching track data...');

  const pythonScript = path.join(__dirname, 'spotify_downloader.py');

  if (!fs.existsSync(pythonScript)) {
    return { platform: 'spotify', mediaItems: [], error: 'spotify_downloader.py not found' };
  }

  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const python = process.env.PYTHON_PATH || 'python';

    const proc = spawn(python, [pythonScript, url], {
      cwd: path.dirname(pythonScript),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        // Find downloaded file
        const files = fs.readdirSync(OUTPUT_DIR)
          .filter(f => f.endsWith('.mp3') || f.endsWith('.m4a'))
          .sort((a, b) => fs.statSync(path.join(OUTPUT_DIR, b)).mtime - fs.statSync(path.join(OUTPUT_DIR, a)).mtime);

        if (files.length > 0) {
          const latest = files[0];
          const filePath = path.join(OUTPUT_DIR, latest);

          // Extract info from output
          const titleMatch = stdout.match(/Found:\s*(.+?)(?:\n|$)/);
          const artistMatch = stdout.match(/Artist:\s*(.+?)(?:\n|$)/);
          const albumMatch = stdout.match(/Album:\s*(.+?)(?:\n|$)/);
          const durationMatch = stdout.match(/Duration:\s*(.+?)(?:\n|$)/);

          const title = titleMatch ? titleMatch[1].trim() : latest.replace(/\.(mp3|m4a)$/i, '');
          const artist = artistMatch ? artistMatch[1].trim() : 'Spotify';
          const album = albumMatch ? albumMatch[1].trim() : '';
          const duration = durationMatch ? durationMatch[1].trim() : '';

          // Build description
          const description = `Album: ${album} | Duration: ${duration}`.trim();

          console.log(`  ✓ Title: ${title}`);
          console.log(`  ✓ Artist: ${artist}`);
          if (album) console.log(`  ✓ Album: ${album}`);
          if (duration) console.log(`  ✓ Duration: ${duration}`);

          resolve({
            platform: 'spotify',
            title: title,
            uploader: artist,
            description: description,
            mediaItems: [{
              type: 'audio',
              url: filePath,
              extension: path.extname(latest).replace('.', ''),
              description: `Audio: ${title} - ${artist}`
            }]
          });
        } else {
          resolve({ platform: 'spotify', mediaItems: [], error: 'Download completed but file not found' });
        }
      } else {
        resolve({ platform: 'spotify', mediaItems: [], error: stderr || 'Download failed' });
      }
    });

    proc.on('error', (err) => {
      resolve({ platform: 'spotify', mediaItems: [], error: err.message });
    });
  });
}

/**
 * Download all media
 */
async function downloadAllMedia(mediaData) {
  const { mediaItems, title, uploader, platform } = mediaData;

  if (!mediaItems?.length) {
    console.log('\n⚠ No media found!');
    return { success: 0, failed: 0 };
  }

  console.log(`\n📊 Media: ${mediaItems.length} file(s) | Types: ${[...new Set(mediaItems.map(m => m.type))].join(', ')}`);
  console.log('\n📥 Downloading...');

  let success = 0, failed = 0;

  if (title || uploader) {
    console.log(`   Title: ${title || 'N/A'}`);
    console.log(`   Artist: ${uploader || 'N/A'}`);
  }

  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i];
    const filename = generateFilename(title, uploader, item.extension, i);
    const filepath = path.join(OUTPUT_DIR, filename);

    let result;
    if (item.type === 'video' || item.type === 'animated_gif') {
      // TikTok @prevter/scraper returns buffer directly
      if (item._tiktokVideo) {
        console.log(`  ↓ Downloading TikTok video: ${filename}`);
        try {
          const buffer = await item._tiktokVideo.download();
          fs.writeFileSync(filepath, buffer);
          const size = buffer.length;
          console.log(`  ✓ Saved: ${filename} (${formatBytes(size)})`);
          result = { success: true, size };
        } catch (e) {
          console.log(`  ✗ Failed: ${e.message}`);
          result = { success: false };
        }
      } else {
        result = await downloadWithYtDlp(item.url, filepath, platform);
      }
    } else {
      result = await downloadFile(item.url, filepath, `${item.type} ${i + 1}/${mediaItems.length}`);
    }

    if (result?.success) success++; else failed++;

    if (i < mediaItems.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return { success, failed };
}

/**
 * Generate filename
 */
function generateFilename(title, uploader, extension, index = null) {
  const safeTitle = (title || '').replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 100);
  const safeUploader = (uploader || '').replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 50);

  let filename = safeTitle && safeUploader ? `${safeUploader} - ${safeTitle}`
    : safeTitle || safeUploader || 'media';

  if (index !== null) filename += `_${String(index + 1).padStart(2, '0')}`;
  return `${filename}.${extension}`;
}

/**
 * Format bytes
 */
function formatBytes(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║        Multi-Platform Media Downloader v1.0                    ║
╠════════════════════════════════════════════════════════════════╣
║  Packages:                                                     ║
║  ✓ play-dl (YouTube metadata)                                  ║
║  ✓ instagram-private-api (Instagram)                           ║
║  ✓ twitter-api-v2 (Twitter/X)                                  ║
║  ✓ @prevter/tiktok-scraper (TikTok no-watermark)               ║
║  ✓ spotdl (Spotify audio)                                      ║
║  ✓ yt-dlp (fallback for all platforms)                         ║
╠════════════════════════════════════════════════════════════════╣
║  Supported: Twitter, Instagram, TikTok, YouTube, Spotify       ║
║             Facebook, Reddit, Pinterest                        ║
╠════════════════════════════════════════════════════════════════╣
║  TikTok Proxy Support (random from proxy.txt):                 ║
║  - Auto-selects random proxy for each attempt                  ║
║  - Retries up to 3 times with different proxies                ║
║  - Set TIKTOK_PROXY env var to override                        ║
╚════════════════════════════════════════════════════════════════╝
Usage: node multi-platform-media-downloader.cjs <url>
    `);
    process.exit(1);
  }

  const url = args[0];
  console.log('═'.repeat(60));
  console.log('  Multi-Platform Media Downloader v2.0');
  console.log('═'.repeat(60));
  console.log(`\n🔗 URL: ${url}`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`📁 Output: ${path.resolve(OUTPUT_DIR)}`);

  try {
    const mediaData = await extractMedia(url);

    if (mediaData.error) {
      console.log(`\n⚠ ${mediaData.error}`);
      process.exit(1);
    }

    if (!mediaData.mediaItems?.length) {
      console.log('\n⚠ No media found!');
      process.exit(1);
    }

    const result = await downloadAllMedia(mediaData);

    console.log('\n' + '═'.repeat(60));
    console.log('  Download Summary');
    console.log('═'.repeat(60));
    console.log(`  ✓ Success: ${result.success}`);
    console.log(`  ✗ Failed: ${result.failed}`);
    console.log(`  📁 Output: ${path.resolve(OUTPUT_DIR)}`);
    console.log('═'.repeat(60));

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
