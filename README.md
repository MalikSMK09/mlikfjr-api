# Masukkan Nama Media Downloader API v1.0

Professional REST API untuk download media (foto, video, audio) dari berbagai platform sosial dan musik. Didesain khusus untuk integrasi dengan bot WhatsApp dan deployment di production.

## 🚀 Fitur Utama

- ✅ **12 Platform Supported**: YouTube, YouTube Music, Spotify, Instagram, Threads, TikTok, Twitter/X, Facebook, Pixiv, Pinterest, Reddit, Fandom
- ✅ **Multi-Media Support**: Album, carousel, playlist, thread support
- ✅ **Cookie Management**: Auto-detect cookie per platform
- ✅ **Robust Error Handling**: Partial success, retry mechanism, detailed error messages
- ✅ **Security**: Multi-tier API key (INT, PUB, DEV, PRO), rate limiting, validation
- ✅ **Production Ready**: Scalable, stable, optimized untuk multiple calls
- ✅ **Metadata Extraction**: Title, duration, uploader, views, etc.
- ✅ **Auto Cleanup**: Configurable TTL untuk file cleanup
- ✅ **Streaming**: Efficient file serving tanpa load ke RAM

## ⚙️ Panduan Setup (Wajib Dibaca)

Repository ini menggunakan placeholder "Masukkan Nama" untuk data pribadi Anda. Ikuti langkah-langkah berikut untuk mengkonfigurasi:

### 1. Setup Nama dan API Keys

Edit file `.env`:
```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
FILE_TTL_HOURS=24
COOKIES_DIR=cookies
DOWNLOADS_DIR=downloads

# API Keys - Ganti dengan key Anda sendiri
API_KEY_INTERNAL=your_internal_key
API_KEY_PUBLIC=your_public_key
API_KEY_DEVELOPMENT=your_dev_key
API_KEY_PRODUCTION=your_production_key
```

### 2. Setup Nama di Kode

Ganti semua placeholder "Masukkan Nama" dengan nama Anda:
- `package.json` - field "author"
- `src/server.js` - nama server di banner

### 3. Setup API Key di Kode

Ganti placeholder API key di `src/middleware/auth.middleware.js` atau di tempat lain jika ada.

### 4. Generate API Key Baru

Gunakan command berikut untuk generate UUID:
```bash
node -e "console.log(require('crypto').randomUUID())"
```

### 5. Setup Cookie (Optional)

Untuk platform yang memerlukan cookie:
```bash
# Buat folder cookies jika belum ada
mkdir -p cookies

# Export cookie dari browser dan simpan di folder cookies/
# Contoh: cookies/youtube.txt, cookies/instagram.txt, dll
```

### 6. Cara Mendapatkan Cookie

1. Install ekstensi browser:
   - Chrome: "Get cookies.txt LOCALLY"
   - Firefox: "cookies.txt"
2. Buka platform yang ingin di-download
3. Login ke akun Anda
4. Export cookies untuk domain tersebut
5. Simpan di folder `cookies/` sesuai nama platform

## 📋 Daftar Platform

| Platform | Status | Cookie | Multi-Media | Types |
|----------|--------|--------|-------------|-------|
| YouTube | ✅ | Optional | ✅ | Video, Shorts, Playlist, Live |
| YouTube Music | ✅ | Required | ✅ | Track, Album, Playlist |
| Spotify | ✅ | Required | ✅ | Track, Album, Playlist |
| Instagram | ✅ | Required | ✅ | Post, Reel, Story, Carousel |
| Threads | ✅ | Required | ✅ | Post, Thread |
| TikTok | ✅ | Required | ❌ | Video |
| Twitter/X | ✅ | Required | ✅ | Video, Image, Thread |
| Facebook | ✅ | Required | ✅ | Video, Post |
| **Pixiv** | ✅ | **Required** | ❌ | **Image, Illustration** |
| Pinterest | ✅ | Optional | ❌ | Image, Video |
| Reddit | ✅ | Optional | ❌ | Video, Image, GIF |
| Fandom | ✅ | Optional | ❌ | Image, Video, Trailer |

## 🛠️ Prasyarat

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **yt-dlp** - Install via pip: `pip install yt-dlp`

## 📦 Instalasi

```bash
git clone <repository-url>
cd masukkan-nama-api

npm install

cp .env.example .env
```

### Setup Environment

Edit file `.env`:

```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
FILE_TTL_HOURS=24
```

### Install yt-dlp

```bash
# Via pip (recommended)
pip install yt-dlp

# Verify installation
yt-dlp --version
```

### Jalankan Server

```bash
npm start
```

Server akan berjalan di `http://localhost:3000`

## 🔑 API Keys

API menggunakan sistem multi-tier API key:

| Type | Key Prefix | Usage |
|------|------------|-------|
| Internal | Masukkan Nama_INT_ | Internal development |
| Public | Masukkan Nama_PUB_ | Public access |
| Development | Masukkan Nama_DEV_ | Testing environment |
| Production | Masukkan Nama_PRO_ | Production use |

**Production API Key**: `Masukkan Nama_PRO_`

Gunakan header: `x-api-key: <API_KEY>`

## 📚 API Endpoints

### 1. Download Media

**Endpoint**: `POST /api/download`

**Headers**:
```
x-api-key: Masukkan Nama_PRO_
Content-Type: application/json
```

**Request Body**:
```json
{
  "text": "Pesan dari WhatsApp yang berisi URL",
  "quality": "best",
  "includeMetadata": true
}
```

**Quality Options**: `best`, `worst`, `720`, `480`, `360`

**cURL Example**:
```bash
curl -X POST http://localhost:3000/api/download \
  -H "x-api-key: Masukkan Nama_PRO_" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Lihat video ini https://youtu.be/dQw4w9WgXcQ dan foto IG https://instagram.com/p/xyz123"
  }'
```

**Response Success**:
```json
{
  "status": true,
  "message": "Download completed successfully",
  "data": {
    "urlsProcessed": 2,
    "successful": 2,
    "failed": 0,
    "totalFiles": 3,
    "results": [
      {
        "url": "https://youtu.be/dQw4w9WgXcQ",
        "platform": "youtube",
        "platformName": "YouTube",
        "success": true,
        "files": [
          {
            "filename": "dQw4w9WgXcQ_1.mp4",
            "path": "/files/dQw4w9WgXcQ_1.mp4",
            "size_bytes": 1234567,
            "mime": "video/mp4",
            "type": "video"
          }
        ],
        "metadata": {
          "title": "Rick Astley - Never Gonna Give You Up",
          "duration": 212,
          "uploader": "RickAstleyVEVO",
          "view_count": 123456789
        },
        "error": null,
        "partialSuccess": false
      }
    ]
  },
  "summary": {
    "total": 2,
    "success": 2,
    "errors": 0,
    "totalFiles": 3
  }
}
```

**Response Partial Success**:
```json
{
  "status": true,
  "message": "Download completed successfully",
  "data": {
    "urlsProcessed": 2,
    "successful": 1,
    "failed": 1,
    "totalFiles": 1,
    "results": [
      {
        "url": "https://instagram.com/p/valid",
        "platform": "instagram",
        "success": true,
        "files": [...],
        "metadata": {...},
        "error": null
      },
      {
        "url": "https://private-video.com/watch",
        "platform": "youtube",
        "success": false,
        "files": [],
        "error": "Video is private or requires authentication"
      }
    ]
  }
}
```

### 2. Get Platforms

**Endpoint**: `GET /api/platforms`

**Headers**:
```
x-api-key: Masukkan Nama_PRO_
```

**Response**:
```json
{
  "status": true,
  "data": {
    "platforms": [
      {
        "platform": "youtube",
        "name": "YouTube",
        "requiresCookie": false,
        "supportsMultiMedia": true,
        "cookieAvailable": false
      }
    ],
    "total": 12
  }
}
```

### 3. Health Check

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": true,
  "message": "Masukkan Nama Media Downloader API is running",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "endpoints": {
    "download": "POST /api/download",
    "fileAccess": "GET /api/files/:filename",
    "platforms": "GET /api/platforms",
    "health": "GET /api/health"
  }
}
```

### 4. File Access

**Endpoint**: `GET /api/files/:filename`

**Example**:
```bash
curl -O http://localhost:3000/api/files/dQw4w9WgXcQ_1.mp4
```

## 🍪 Cookie Setup (Optional)

Untuk success rate yang lebih tinggi, especialmente untuk platform yang **memerlukan** cookie:

### Cara Export Cookie

**Chrome/Firefox:**

1. Buka platform (contoh: instagram.com)
2. Login ke akun
3. Install ekstensi:
   - Chrome: "Get cookies.txt LOCALLY"
   - Firefox: "cookies.txt"
4. Export cookies untuk domain tersebut
5. Simpan di folder `cookies/` dengan nama sesuai platform:
   - `cookies/youtube.txt`
   - `cookies/youtubemusic.txt`
   - `cookies/spotify.txt`
   - `cookies/instagram.txt`
   - `cookies/threads.txt`
   - `cookies/tiktok.txt`
   - `cookies/twitter.txt`
   - `cookies/facebook.txt`
   - `cookies/pixiv.txt`
   - `cookies/pinterest.txt`
   - `cookies/reddit.txt`
   - `cookies/fandom.txt`

**⚠️ PENTING:**
- Cookie opsional untuk semua platform
- Platform yang requires cookie akan tetap mencoba tanpa cookie
- Jangan share cookie file Anda!
- Cookie akan expire, perlu update berkala

## 🔧 Integration dengan Bot WhatsApp

### Node.js Example

```javascript
const axios = require('axios');

class Masukkan NamaMediaDownloader {
  constructor(apiKey, baseUrl = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async downloadFromText(text) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/download`,
        {
          text,
          quality: 'best',
          includeMetadata: true
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      );

      if (response.data.status) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Download failed');
      }
    } catch (error) {
      console.error('Download error:', error.message);
      throw error;
    }
  }

  async processWhatsAppMessage(message) {
    const result = await this.downloadFromText(message);

    const mediaFiles = [];

    for (const item of result.results) {
      if (item.success && item.files.length > 0) {
        for (const file of item.files) {
          mediaFiles.push({
            platform: item.platform,
            title: item.metadata?.title,
            url: `${this.baseUrl}${file.path}`,
            type: file.type,
            size: file.size_bytes,
            metadata: item.metadata
          });
        }
      }
    }

    return {
      totalFiles: result.totalFiles,
      successful: result.successful,
      failed: result.failed,
      files: mediaFiles
    };
  }
}

// Usage
const downloader = new Masukkan NamaMediaDownloader(
  'Masukkan Nama_PRO_'
);

const message = "Lihat video ini https://youtu.be/dQw4w9WgXcQ";
downloader.processWhatsAppMessage(message)
  .then(result => {
    console.log('Downloaded:', result.totalFiles, 'files');
    result.files.forEach(file => {
      console.log(`${file.platform}: ${file.title} - ${file.url}`);
    });
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

### Python Example

```python
import requests

class Masukkan NamaMediaDownloader:
    def __init__(self, api_key, base_url='http://localhost:3000'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json'
        }

    def download_from_text(self, text, quality='best'):
        response = requests.post(
            f'{self.base_url}/api/download',
            json={
                'text': text,
                'quality': quality,
                'includeMetadata': True
            },
            headers=self.headers,
            timeout=120
        )

        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"API Error: {response.text}")

    def process_whatsapp_message(self, message):
        result = self.download_from_text(message)

        if not result.get('status'):
            raise Exception(result.get('error', 'Download failed'))

        media_files = []
        for item in result['data']['results']:
            if item['success'] and item['files']:
                for file in item['files']:
                    media_files.append({
                        'platform': item['platform'],
                        'title': item['metadata'].get('title') if item['metadata'] else None,
                        'url': f"{self.base_url}{file['path']}",
                        'type': file['type'],
                        'size': file['size_bytes']
                    })

        return {
            'total_files': result['data']['totalFiles'],
            'successful': result['data']['successful'],
            'failed': result['data']['failed'],
            'files': media_files
        }

# Usage
downloader = Masukkan NamaMediaDownloader('Masukkan Nama_PRO_')
message = "Lihat video ini https://youtu.be/dQw4w9WgXcQ"
result = downloader.process_whatsapp_message(message)
print(f"Downloaded: {result['total_files']} files")
```

## 📁 Struktur Proyek

```
/
├── 📁 src/
│   ├── server.js                    # Express server entry point
│   ├── 📁 routes/
│   │   └── api.routes.js            # API routes & middleware
│   ├── 📁 controllers/
│   │   └── download.controller.js   # Request handlers
│   ├── 📁 services/
│   │   ├── cookie.service.js        # Cookie management
│   │   ├── platform.service.js      # Platform detection
│   │   ├── extractor.service.js     # URL extraction
│   │   ├── download.service.js      # Download logic
│   │   └── ytdlp.service.js         # yt-dlp wrapper
│   └── 📁 middleware/
│       └── auth.middleware.js       # API key authentication
├── 📁 scripts/
│   └── check-setup.js               # Setup verification
├── 📁 cookies/                      # Cookie files (optional)
├── 📁 downloads/                    # Downloaded media files
├── .env.example                     # Environment template
├── package.json
└── README.md
```

## 🔒 Keamanan

- ✅ **API Key Authentication**: Multi-tier key system
- ✅ **Rate Limiting**: 30 requests/minute per IP
- ✅ **Input Validation**: URL validation, file sanitization
- ✅ **Error Handling**: Comprehensive error messages
- ✅ **Helmet.js**: Security headers
- ✅ **CORS**: Configurable cross-origin requests
- ✅ **Logging**: Pino logger untuk monitoring

## ⚡ Error Handling

API dirancang untuk **TIDAK CRASH** dalam kondisi apapun:

### Error Types

1. **Invalid URL** → Return error, continue processing other URLs
2. **Unsupported Platform** → Return error, continue processing
3. **Private/Restricted Media** → Return error with reason
4. **Cookie Not Found** → Proceed without cookie (may fail)
5. **Cookie Expired** → Log warning, proceed without cookie
6. **Network Error** → Retry up to 3 times

### Partial Success

Jika satu URL gagal dan lainnya berhasil:
- Status: `true` (partial success)
- Include both successful and failed results
- Clear error messages per URL

## 🚀 Deployment

### Hostinger VPS

1. **Setup Node.js**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Install PM2** (Process Manager):
```bash
npm install -g pm2
```

3. **Deploy**:
```bash
git clone <repository-url>
cd masukkan-nama-api
npm install
cp .env.example .env

# Edit .env
# Set NODE_ENV=production
# Set appropriate PORT (e.g., 3000)
# Ganti API keys dengan key Anda sendiri

pm2 start src/server.js --name "masukkan-nama-api"
pm2 startup
pm2 save
```

4. **Nginx Reverse Proxy** (Optional):
```nginx
server {
    listen 80;
    server_name api.masukkan-nama.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker (Alternative)

```bash
docker build -t masukkan-nama-api .
docker run -p 3000:3000 \
  -v $(pwd)/cookies:/app/cookies \
  -v $(pwd)/downloads:/app/downloads \
  masukkan-nama-api
```

## 📊 Monitoring

### Logs

Logs menggunakan **Pino** logger dengan format yang mudah dibaca:

```bash
# View logs
pm2 logs masukkan-nama-api

# Follow logs
pm2 logs masukkan-nama-api --lines 100 -f
```

### Health Checks

```bash
curl http://localhost:3000/api/health
```

### Metrics to Monitor

- Request count
- Success/failure rate
- Platform distribution
- Average download time
- File size distribution
- Error types

## 🔧 Troubleshooting

### Issue: "yt-dlp not found"

**Solution**:
```bash
pip install --upgrade yt-dlp

# Verify
yt-dlp --version
```

### Issue: "Permission denied" (Linux/macOS)

**Solution**:
```bash
chmod +x $(which yt-dlp)
```

### Issue: Download fails with "Private video"

**Solution**:
1. Check if cookie is required for that platform
2. Export fresh cookie from browser
3. Place in `cookies/` folder

### Issue: "Cookies expired"

**Solution**:
1. Re-export cookies from browser
2. Replace file in `cookies/` folder
3. Restart server

### Issue: High memory usage

**Solution**:
1. Enable file cleanup: Set `FILE_TTL_HOURS` in `.env`
2. Lower quality: Use `quality: "720"` instead of `"best"`
3. Monitor with `pm2 monit`

## ⚖️ Legal & Ethics

⚠️ **IMPORTANT DISCLAIMER:**

1. **Hak Cipta**: Pastikan Anda memiliki izin untuk mengunduh konten. Respek hak cipta dan ToS platform.

2. **Penggunaan Pribadi**: API ini intended untuk penggunaan pribadi/educational.

3. **Rate Limit**: Jangan spam request. Gunakan secara wajar.

4. **Konten Sensitif**: Jangan gunakan untuk konten illegal atau tidak pantas.

5. **Bot WhatsApp**: Pastikan comply dengan WhatsApp Terms of Service.

**DISCLAIMER**: Pengembang tidak bertanggung jawab atas penyalahgunaan API ini. Gunakan dengan bijak dan bertanggung jawab.

## 📝 Changelog

### v1.0.0
- ✨ Initial release
- ✨ Support for 12 platforms: YouTube, YouTube Music, Spotify, Instagram, Threads, TikTok, Twitter/X, Facebook, Pixiv, Pinterest, Reddit, Fandom
- ✨ Multi-tier API key system (INT, PUB, DEV, PRO)
- ✨ Cookie-based authentication support
- ✨ Robust error handling with retry mechanism
- ✨ Metadata extraction (title, artist, description, etc.)
- ✨ Production ready with rate limiting and security headers

## 📧 Support

Untuk bug reports atau feature requests, silakan buat issue di repository GitHub.

## 📄 License

MIT License - Lihat file LICENSE untuk detail.

---

**Masukkan Nama Media Downloader API v2.0** - Professional Grade Media Downloader untuk WhatsApp Bot