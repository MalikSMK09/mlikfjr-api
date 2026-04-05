import pino from 'pino';

const logger = pino({
  name: 'api-middleware',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Function to build valid API keys from environment variables
// This is called lazily because ES modules import hoisting means
// process.env is not populated at module load time
function buildValidApiKeys() {
  const validApiKeys = {};

  if (process.env.API_KEY_INTERNAL) {
    validApiKeys[process.env.API_KEY_INTERNAL] = 'internal';
  }
  if (process.env.API_KEY_PUBLIC) {
    validApiKeys[process.env.API_KEY_PUBLIC] = 'public';
  }
  if (process.env.API_KEY_DEVELOPMENT) {
    validApiKeys[process.env.API_KEY_DEVELOPMENT] = 'development';
  }
  if (process.env.API_KEY_PRODUCTION) {
    validApiKeys[process.env.API_KEY_PRODUCTION] = 'production';
  }

  return validApiKeys;
}

// Cache for validated API keys (populated on first use)
let cachedValidApiKeys = null;

function getValidApiKeys() {
  if (!cachedValidApiKeys) {
    cachedValidApiKeys = buildValidApiKeys();
  }
  return cachedValidApiKeys;
}

export function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    logger.warn({ ip: req.ip }, 'Missing API key');
    return res.status(401).json({
      status: false,
      error: 'Unauthorized',
      message: 'API key is required. Please include x-api-key header.'
    });
  }

  const validApiKeys = getValidApiKeys();
  const keyType = validApiKeys[apiKey];

  if (!keyType) {
    logger.warn({ ip: req.ip, apiKey: apiKey.substring(0, 10) + '...' }, 'Invalid API key');
    return res.status(403).json({
      status: false,
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }

  req.apiKeyType = keyType;
  logger.info({ ip: req.ip, keyType }, 'API key validated');
  next();
}

export function validateApiKeysConfig() {
  const validApiKeys = getValidApiKeys();
  if (Object.keys(validApiKeys).length === 0) {
    logger.error('No valid API keys configured');
    throw new Error('API keys must be configured');
  }
  logger.info('API keys configuration validated');
}