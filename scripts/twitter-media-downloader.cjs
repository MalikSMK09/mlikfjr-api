/**
 * Twitter/X Media Downloader Script
 * Download all photos and videos from a tweet URL using yt-dlp
 *
 * Usage: node twitter-media-downloader.cjs <tweet_url>
 * Example: node twitter-media-downloader.cjs https://x.com/username/status/123456789
 *
 * Requirements:
 * - yt-dlp installed (pip install yt-dlp)
 * - cookies/twitter.txt with valid Twitter cookies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'downloads');
const COOKIES_FILE = path.join(__dirname, '..', 'cookies', 'twitter.txt');
const DELAY_BETWEEN_DOWNLOADS = 500;

/**
 * Extract tweet ID from URL
 */
function extractTweetId(url) {
  const patterns = [
    /x\.com\/\w+\/status\/(\d+)/,
    /twitter\.com\/\w+\/status\/(\d+)/,
    /mobile\.twitter\.com\/\w+\/status\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error('Invalid tweet URL format');
}

/**
 * Check if yt-dlp is installed
 */
function checkYtDlp() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if cookies file exists
 */
function checkCookies() {
  return fs.existsSync(COOKIES_FILE);
}

/**
 * Get tweet info using yt-dlp
 */
async function getTweetInfo(url) {
  console.log('Fetching tweet info...');

  const args = [
    '--cookies', COOKIES_FILE,
    '--print', '%(uploader)s|%(title)s|%(upload_date)s|%(thumbnail)s',
    '--no-download',
    url
  ];

  try {
    const output = execSync(`yt-dlp ${args.join(' ')}`, {
      encoding: 'utf-8',
      timeout: 60000,
    }).trim();

    const [uploader, title, uploadDate, thumbnail] = output.split('|');
    return { uploader, title, uploadDate, thumbnail };
  } catch (error) {
    console.log('Could not get tweet info:', error.message);
    return null;
  }
}

/**
 * Get all media URLs from tweet using yt-dlp
 */
function getMediaUrls(url) {
  console.log('Extracting media URLs...');

  const args = [
    '--cookies', COOKIES_FILE,
    '--dump-json',
    '--no-download',
    url
  ];

  try {
    const output = execSync(`yt-dlp ${args.join(' ')}`, {
      encoding: 'utf-8',
      timeout: 120000,
    });

    const data = JSON.parse(output);
    const mediaItems = [];

    // Extract photos from entries/entities
    const entries = data.entries || [data];

    for (const entry of entries) {
      if (!entry) continue;

      // Get thumbnail as photo fallback
      if (entry.thumbnail) {
        mediaItems.push({
          type: 'photo',
          url: entry.thumbnail,
          extension: 'jpg',
          description: 'Tweet thumbnail'
        });
      }

      // Get video formats
      if (entry.formats) {
        // Filter video formats with video codec
        const videoFormats = entry.formats
          .filter(f => f.vcodec && f.vcodec !== 'none' && f.ext === 'mp4')
          .sort((a, b) => (b.width * b.height || 0) - (a.width * a.height || 0));

        if (videoFormats.length > 0) {
          const bestVideo = videoFormats[0];
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
    }

    return { mediaItems, tweetData: data };
  } catch (error) {
    throw new Error(`Failed to extract media: ${error.message}`);
  }
}

/**
 * Download a single file with proper headers
 */
async function downloadFile(url, filepath, description, isVideo = false, tweetUrl = null) {
  console.log(`Downloading ${description}...`);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://x.com/',
  };

  try {
    // For videos, yt-dlp URLs might need special handling
    // If URL contains manifest/token markers, use yt-dlp directly
    if (isVideo && tweetUrl && (url.includes('m3u8') || url.length < 100 || url.includes('?'))) {
      console.log(`  → Using yt-dlp direct download for video...`);
      return await downloadWithYtDlp(filepath, description, tweetUrl);
    }

    const response = await axios.get(url, {
      headers,
      responseType: 'arraybuffer',
      timeout: 120000,
      maxRedirects: 10,
    });

    fs.writeFileSync(filepath, response.data);
    const size = response.data.length;

    console.log(`  ✓ Saved: ${filepath} (${formatBytes(size)})`);
    return { success: true, size };
  } catch (error) {
    console.error(`  ✗ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Download video using yt-dlp directly
 */
async function downloadWithYtDlp(filepath, description, tweetUrl) {
  try {
    // Use yt-dlp to download directly with cookies
    const args = [
      '--cookies', COOKIES_FILE,
      '-o', filepath.replace(/\\/g, '/').replace('.mp4', '.%(ext)s'),
      '--no-part',
      '--no-mtime',
      '--format', 'best[ext=mp4]/best',
      tweetUrl
    ];

    execSync(`yt-dlp ${args.join(' ')}`, {
      encoding: 'utf-8',
      timeout: 180000,
    });

    // Find the downloaded file
    const dir = path.dirname(filepath);
    const base = path.basename(filepath, '.mp4');
    const downloaded = fs.readdirSync(dir).find(f => f.startsWith(base) && f.endsWith('.mp4'));

    if (downloaded) {
      const newPath = path.join(dir, downloaded);
      fs.renameSync(newPath, filepath);
      const size = fs.statSync(filepath).size;
      console.log(`  ✓ Saved: ${filepath} (${formatBytes(size)})`);
      return { success: true, size };
    }

    // Check if file exists at original path
    if (fs.existsSync(filepath)) {
      const size = fs.statSync(filepath).size;
      console.log(`  ✓ Saved: ${filepath} (${formatBytes(size)})`);
      return { success: true, size };
    }

    return { success: false, error: 'File not created' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node twitter-media-downloader.cjs <tweet_url>');
    console.log('Example: node twitter-media-downloader.cjs https://x.com/username/status/123456789');
    process.exit(1);
  }

  const tweetUrl = args[0];

  console.log('Twitter Media Downloader');
  console.log('-'.repeat(40));
  console.log(`URL: ${tweetUrl}`);

  // Check requirements
  if (!checkYtDlp()) {
    console.error('Error: yt-dlp not installed. Run: pip install yt-dlp');
    process.exit(1);
  }

  if (!checkCookies()) {
    console.error('Error: cookies/twitter.txt not found');
    process.exit(1);
  }

  try {
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Get media URLs
    const { mediaItems } = getMediaUrls(tweetUrl);

    if (mediaItems.length === 0) {
      console.log('No media found in this tweet.');
      return;
    }

    console.log(`Found ${mediaItems.length} media(s): ${mediaItems.map(m => m.type).join(', ')}`);

    // Download all media
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i];
      const filename = `media_${String(i + 1).padStart(2, '0')}.${item.extension}`;
      const filepath = path.join(OUTPUT_DIR, filename);

      const result = await downloadFile(
        item.url,
        filepath,
        `${item.type} ${i + 1}/${mediaItems.length}`,
        item.type === 'video',
        tweetUrl
      );

      if (result.success) successCount++;
      else failCount++;

      if (i < mediaItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DOWNLOADS));
      }
    }

    // Summary
    console.log('-'.repeat(40));
    console.log(`Downloaded: ${successCount}/${mediaItems.length}`);
    console.log(`Output: ${path.resolve(OUTPUT_DIR)}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run main function
main();
