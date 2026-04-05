import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.routes.js';
import { proxyService } from './services/proxy.service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Prefer WEBSITE_PORT (for serving the React site) then PORT; default to 3001 to avoid clashing
const PORT = process.env.WEBSITE_PORT || process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for accurate IP detection behind reverse proxy
app.set('trust proxy', true);

// Serve static files from downloads directory
const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(__dirname, '..', 'downloads');
app.use('/downloads', express.static(DOWNLOADS_DIR));

// API Routes (v1)
app.use('/v1', apiRoutes);
// Serve website build (if present) so the root can display the React app
// Note: `website` folder has been moved under `src`, so use relative path from __dirname
const WEBSITE_DIST = path.join(__dirname, 'website', 'dist');
if (fs.existsSync(WEBSITE_DIST)) {
  app.use(express.static(WEBSITE_DIST));

  app.get('/', (req, res) => {
    res.sendFile(path.join(WEBSITE_DIST, 'index.html'));
  });

  // SPA fallback: serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/v1') || req.path.startsWith('/downloads')) return next();
    res.sendFile(path.join(WEBSITE_DIST, 'index.html'));
  });
} else {
  // Default root JSON when website build is not available
  app.get('/', (req, res) => {
    res.json({
      name: 'Masukkan Nama Media Downloader API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: 'GET /v1/core/health',
        download: 'POST /v1/downloader',
        tools: 'GET /v1/tools/*',
        ai: 'GET /v1/ai/*'
      }
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    status: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║          Masukkan Nama Media Downloader API v1.0                 ║
║══════════════════════════════════════════════════════════║
║  Server running on: http://localhost:${PORT}             ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(42)}║
║══════════════════════════════════════════════════════════║
║  Endpoints:                                              ║
║  - GET  /v1/core/health    : Health check                ║
║  - POST /v1/downloader     : Download media              ║
║  - GET  /v1/tools/*        : Utility tools               ║
║  - GET  /v1/ai/*           : AI features                 ║
╚══════════════════════════════════════════════════════════╝
  `);

  // Log proxy status
  const proxyCount = proxyService.getProxyCount();
  console.log(`[Server] Loaded ${proxyCount} proxies`);
});

export default app;