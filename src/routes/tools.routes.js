import express from 'express';
import { uuidService } from '../services/uuid.service.js';
import { hashService } from '../services/hash.service.js';
import { base64Service } from '../services/base64.service.js';
import { shortenerService } from '../services/shortener.service.js';
import { memeService } from '../services/meme.service.js';
import { quoteService } from '../services/quote.service.js';
import { lyricsService } from '../services/lyrics.service.js';
import { stalkerService } from '../services/stalker.service.js';

const router = express.Router();

// UUID
router.get('/uuid', (req, res) => {
  const { version } = req.query;
  const result = uuidService.generate(version);
  res.json(result);
});

// Hash
router.post('/hash', (req, res) => {
  const { input, algorithm = 'sha256' } = req.body;
  if (!input) {
    return res.status(400).json({ success: false, error: 'Input is required' });
  }
  const result = hashService.hash(input, algorithm);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// Base64
router.post('/base64', (req, res) => {
  const { text, mode = 'encode', url_safe } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, error: 'Text is required' });
  }
  let result;
  if (url_safe) result = base64Service.encodeUrlSafe(text);
  else if (mode === 'decode') result = base64Service.decode(text);
  else result = base64Service.encode(text);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// Shorten URL
router.post('/shorten', async (req, res) => {
  const { url, custom } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }
  const result = await shortenerService.shorten(url, custom);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// Get Shortened URL
router.get('/shorten/:code', async (req, res) => {
  const { code } = req.params;
  const result = await shortenerService.get(code);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

// ============ GAME ENDPOINTS ============

// GET /tools/meme - Random Meme
router.get('/meme', (req, res) => {
  const result = memeService.getRandom();
  res.json(result);
});

// GET /tools/quote - Random Quote
router.get('/quote', (req, res) => {
  const { category } = req.query;
  const result = quoteService.getRandom(category);
  res.json(result);
});

// GET /tools/quote/categories - List quote categories
router.get('/quote/categories', (req, res) => {
  const result = quoteService.getCategories();
  res.json(result);
});

// ============ SEARCH ENDPOINTS ============

// GET /tools/lyrics - Search lyrics
router.get('/lyrics', (req, res) => {
  const { q, limit = 5 } = req.query;
  if (!q) {
    return res.status(400).json({ success: false, error: 'Query (q) is required' });
  }
  const result = lyricsService.search(q, parseInt(limit));
  res.json(result);
});

// GET /tools/lyrics/random - Random lyrics
router.get('/lyrics/random', (req, res) => {
  const result = lyricsService.getRandom();
  res.json(result);
});

// ============ STALKER ENDPOINTS ============

// GET /tools/stalk/tiktok - TikTok user info
router.get('/stalk/tiktok', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ success: false, error: 'Username is required' });
  }
  const result = await stalkerService.tiktok.getProfile(username);
  res.json(result);
});

// GET /tools/stalk/instagram - Instagram user info
router.get('/stalk/instagram', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ success: false, error: 'Username is required' });
  }
  const result = await stalkerService.instagram.getProfile(username);
  res.json(result);
});

export default router;
