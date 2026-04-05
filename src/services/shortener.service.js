import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'urls.json');
const BASE_URL = process.env.SHORTENER_BASE_URL || 'https://api.masukkan-nama.com/s';

// Ensure data directory and file exist
async function ensureDataFile() {
  const dataDir = path.dirname(DATA_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, '[]', 'utf8');
  }
}

async function readUrls() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  return JSON.parse(raw || '[]');
}

async function writeUrls(urls) {
  await fs.writeFile(DATA_PATH, JSON.stringify(urls, null, 2), 'utf8');
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function generateCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const shortenerService = {
  async shorten(url, customCode = null) {
    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    if (!isValidUrl(url)) {
      return { success: false, error: 'Invalid URL. Must start with http:// or https://' };
    }

    try {
      const urls = await readUrls();

      // Check if URL already exists
      const existing = urls.find(u => u.originalUrl === url);
      if (existing) {
        return {
          success: true,
          data: {
            originalUrl: existing.originalUrl,
            shortUrl: `${BASE_URL}/${existing.code}`,
            shortCode: existing.code,
            createdAt: existing.createdAt
          }
        };
      }

      // Use custom code or generate one
      let code = customCode || generateCode();

      // Check if custom code already exists
      if (urls.find(u => u.code === code)) {
        if (customCode) {
          return { success: false, error: 'Custom short code already in use' };
        }
        code = generateCode();
      }

      const newUrl = {
        code,
        originalUrl: url,
        createdAt: new Date().toISOString(),
        clicks: 0
      };

      urls.push(newUrl);
      await writeUrls(urls);

      return {
        success: true,
        data: {
          originalUrl: newUrl.originalUrl,
          shortUrl: `${BASE_URL}/${newUrl.code}`,
          shortCode: newUrl.code,
          createdAt: newUrl.createdAt
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async get(code) {
    try {
      const urls = await readUrls();
      const urlEntry = urls.find(u => u.code === code);

      if (!urlEntry) {
        return { success: false, error: 'Short URL code not found' };
      }

      // Increment click count
      urlEntry.clicks = (urlEntry.clicks || 0) + 1;
      await writeUrls(urls);

      return {
        success: true,
        data: {
          originalUrl: urlEntry.originalUrl,
          shortCode: urlEntry.code,
          shortUrl: `${BASE_URL}/${urlEntry.code}`,
          clicks: urlEntry.clicks,
          createdAt: urlEntry.createdAt
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async delete(code) {
    try {
      const urls = await readUrls();
      const index = urls.findIndex(u => u.code === code);

      if (index === -1) {
        return { success: false, error: 'Short URL code not found' };
      }

      urls.splice(index, 1);
      await writeUrls(urls);

      return { success: true, data: { deleted: true, code } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async list() {
    try {
      const urls = await readUrls();
      return {
        success: true,
        data: {
          total: urls.length,
          urls: urls.map(u => ({
            originalUrl: u.originalUrl,
            shortCode: u.code,
            shortUrl: `${BASE_URL}/${u.code}`,
            clicks: u.clicks || 0,
            createdAt: u.createdAt
          }))
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

export default shortenerService;
