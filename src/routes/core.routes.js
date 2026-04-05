import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Store for API keys (in production, use database)
const apiKeysStore = new Map();

// GET /core/health
router.get('/health', (req, res) => {
  const uptime = process.uptime();
  res.json({
    success: true,
    data: {
      uptime: Math.floor(uptime),
      status: 'ok',
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      version: '1.0.0'
    }
  });
});

// POST /core/apikeys/create
router.post('/apikeys/create', (req, res) => {
  const { owner, label } = req.body;

  if (!owner || !label) {
    return res.status(400).json({
      success: false,
      error: 'Owner and label are required'
    });
  }

  // Generate API key
  const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
  const keyId = crypto.randomBytes(8).toString('hex');

  const keyData = {
    id: keyId,
    key: apiKey,
    owner,
    label,
    createdAt: new Date().toISOString(),
    expires: null,
    calls: 0,
    limit: 1000,
    status: 'active'
  };

  apiKeysStore.set(apiKey, keyData);

  res.json({
    success: true,
    data: {
      id: keyData.id,
      apikey: apiKey,
      owner: keyData.owner,
      label: keyData.label,
      createdAt: keyData.createdAt,
      expires: keyData.expires
    }
  });
});

// GET /core/apikeys/usage
router.get('/apikeys/usage', (req, res) => {
  const { apikey } = req.query;

  if (!apikey) {
    return res.status(400).json({
      success: false,
      error: 'API key is required'
    });
  }

  const keyData = apiKeysStore.get(apikey);

  if (!keyData) {
    // Return mock data for demo
    return res.json({
      success: true,
      data: {
        calls: Math.floor(Math.random() * 500),
        limit: 1000,
        reset: Math.floor(Date.now() / 1000) + 86400,
        plan: 'free'
      }
    });
  }

  res.json({
    success: true,
    data: {
      calls: keyData.calls,
      limit: keyData.limit,
      reset: Math.floor(Date.now() / 1000) + 86400,
      plan: 'free'
    }
  });
});

// GET /core/info
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Masukkan Nama Media Downloader API',
      version: '1.0.0',
      description: 'Professional REST API for media downloading and utilities',
      endpoints: {
        core: '/api/core/*',
        tools: '/api/tools/*',
        download: '/api/download',
        ai: '/api/ai/*'
      }
    }
  });
});

export default router;
