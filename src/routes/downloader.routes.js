import express from 'express';
import { enhancedDownloaderService } from '../services/enhancedDownloader.service.js';
import { apiKeyMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Require valid API key for downloader routes
router.use(apiKeyMiddleware);

// POST /downloader/youtube - Download YouTube video
router.post('/youtube', async (req, res) => {
  const { url, quality = 'best', format = 'mp4' } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required',
      message: 'Please provide a YouTube URL'
    });
  }

  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid YouTube URL',
      message: 'Please provide a valid YouTube URL'
    });
  }

  try {
    const result = await enhancedDownloaderService.processUrl(url, {
      quality,
      mode: format === 'mp3' ? 'audio-only' : 'auto',
      maxRetries: 2
    });

    res.json({
      success: result.success,
      data: {
        platform: 'youtube',
        url,
        ...result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Download failed',
      message: error.message
    });
  }
});

// POST /downloader/tiktok - Download TikTok video
router.post('/tiktok', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required',
      message: 'Please provide a TikTok URL'
    });
  }

  if (!url.includes('tiktok.com')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid TikTok URL',
      message: 'Please provide a valid TikTok URL'
    });
  }

  try {
    const result = await enhancedDownloaderService.processUrl(url, {
      quality: 'best',
      mode: 'auto',
      maxRetries: 2
    });

    res.json({
      success: result.success,
      data: {
        platform: 'tiktok',
        url,
        ...result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Download failed',
      message: error.message
    });
  }
});

// POST /downloader/instagram - Download Instagram media
router.post('/instagram', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required',
      message: 'Please provide an Instagram URL'
    });
  }

  if (!url.includes('instagram.com')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Instagram URL',
      message: 'Please provide a valid Instagram URL'
    });
  }

  try {
    const result = await enhancedDownloaderService.processUrl(url, {
      quality: 'best',
      mode: 'auto',
      maxRetries: 2
    });

    res.json({
      success: result.success,
      data: {
        platform: 'instagram',
        url,
        ...result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Download failed',
      message: error.message
    });
  }
});

// POST /downloader/spotify - Download Spotify track
router.post('/spotify', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required',
      message: 'Please provide a Spotify URL'
    });
  }

  if (!url.includes('spotify.com')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Spotify URL',
      message: 'Please provide a valid Spotify URL'
    });
  }

  // For Spotify, return info since full download requires yt-dlp
  const spotifyMatch = url.match(/spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);

  res.json({
    success: true,
    data: {
      platform: 'spotify',
      type: spotifyMatch ? spotifyMatch[1] : 'track',
      id: spotifyMatch ? spotifyMatch[2] : null,
      url,
      message: 'Spotify integration requires yt-dlp.',
      metadata: {
        note: 'Install yt-dlp for full Spotify download support'
      }
    }
  });
});

export default router;
