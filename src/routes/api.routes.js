import express from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import pino from 'pino';
import { apiKeyMiddleware } from '../middleware/auth.middleware.js';
import { downloadRedditMediaForce, isValidRedditUrl } from '../services/reddit.service.js';
import {
  handleDownload,
  handleFileAccess,
  handleGetPlatforms,
  downloadValidation
} from '../controllers/download.controller.js';

// Import new routes
import toolsRoutes from './tools.routes.js';
import aiRoutes from './ai.routes.js';
import coreRoutes from './core.routes.js';
import downloaderRoutes from './downloader.routes.js';

const logger = pino({
  name: 'api-routes',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    status: false,
    error: 'Too many requests',
    message: 'Please try again later. Rate limit: 30 requests per minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      apiKeyType: req.apiKeyType
    }, 'Rate limit exceeded');
    res.status(429).json({
      status: false,
      error: 'Too many requests',
      message: 'Please try again later. Rate limit: 30 requests per minute'
    });
  }
});

router.use(cors());
router.use(limiter);

// Mount new routes
router.use('/tools', toolsRoutes);
router.use('/ai', aiRoutes);
router.use('/core', coreRoutes);
router.use('/downloader', downloaderRoutes);

// Reddit download endpoint (specific handler for Reddit URLs)
router.post(
  '/download',
  apiKeyMiddleware,
  async (req, res) => {
    const { text, quality = 'best' } = req.body;

    console.log(`[API] Download request: ${text?.substring(0, 100)}...`);

    // Validate input
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        status: false,
        error: 'Validation failed',
        details: [{ path: 'text', msg: 'Text field is required' }]
      });
    }

    // Extract URL from text
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    if (!urlMatch) {
      return res.status(400).json({
        status: false,
        error: 'No URL found in text',
        suggestion: 'Please include a valid URL'
      });
    }

    const url = urlMatch[1];

    // Check if it's a Reddit URL
    if (url.includes('reddit.com')) {
      try {
        // Use best-effort forced downloader with multiple strategies
        const result = await downloadRedditMediaForce(url, { quality });

        res.json({
          status: result.success,
          message: result.success ? 'Download completed' : 'Download failed',
          data: result.data || null,
          error: result.error || null,
          metadata: result.metadata || null,
          strategyUsed: result.strategyUsed || null
        });
      } catch (error) {
        console.error(`[API] Reddit Error: ${error.message}`);
        res.status(500).json({
          status: false,
          error: 'Internal server error',
          message: error.message
        });
      }
      return;
    }

    // For non-Reddit URLs, use the existing handler
    req.body.text = text;
    handleDownload(req, res);
  }
);

router.get(
  '/files/:token/:filename',
  handleFileAccess
);

router.get(
  '/files/:filename',
  handleFileAccess
);

router.get(
  '/platforms',
  apiKeyMiddleware,
  handleGetPlatforms
);

router.get(
  '/health',
  (req, res) => {
    res.json({
      status: true,
      message: 'Masukkan Nama Media Downloader API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      endpoints: {
        download: 'POST /api/download',
        fileAccess: 'GET /api/files/:filename',
        platforms: 'GET /api/platforms',
        health: 'GET /api/health'
      }
    });
  }
);

router.use((err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path
  }, 'Unhandled route error');

  res.status(500).json({
    status: false,
    error: 'Internal server error',
    message: err.message
  });
});

export default router;