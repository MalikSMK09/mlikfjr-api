import pino from 'pino';

const logger = pino({
  name: 'error-classifier',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

/**
 * Classify error based on platform, stderr, stdout, and exit code
 * @param {Object} params - Error information
 * @param {string} params.stderr - Standard error output
 * @param {string} params.stdout - Standard output
 * @param {number} params.exitCode - Process exit code
 * @param {number} params.httpStatus - HTTP status code (if available)
 * @param {string} params.platform - Platform identifier
 * @param {string} params.message - Error message
 * @param {string} params.url - URL being processed
 * @returns {Object} - Classified error with type, reason, suggestions, and retryable flag
 */
export function classifyError({
  stderr = '',
  stdout = '',
  exitCode = 0,
  httpStatus = null,
  platform = 'generic',
  message = '',
  url = ''
}) {
  const errorText = `${stderr} ${stdout} ${message}`.toLowerCase();

  logger.debug({
    platform,
    exitCode,
    httpStatus,
    errorText: errorText.substring(0, 200)
  }, 'Classifying error');

  // 1. RATE LIMIT ERRORS
  if (httpStatus === 429 ||
      errorText.includes('too many requests') ||
      errorText.includes('rate limit') ||
      errorText.includes('max retries') ||
      (platform === 'spotify' && (httpStatus === 429 || errorText.includes('429')))) {

    return {
      type: 'RATE_LIMIT',
      platform,
      reason: getRateLimitReason(platform),
      suggestions: getRateLimitSuggestions(platform),
      retryable: true,
      retryAfter: getRetryAfter(platform),
      exitCode: httpStatus || exitCode
    };
  }

  // 2. YOUTUBE - SABR / SIGNATURE PROTECTION
  if ((platform === 'youtube' || platform === 'youtubemusic') &&
      (errorText.includes('sabr') ||
       errorText.includes('signature extraction failed') ||
       errorText.includes('nsig') ||
       errorText.includes('signaturecipher') ||
       errorText.includes('forcing sabr') ||
       (exitCode === 1 && errorText.includes('youtube') && !errorText.includes('private')))) {

    // Detect if cookies are being used
    const hasCookies = errorText.includes('cookies') || !errorText.includes('no cookies');

    return {
      type: 'EXTERNAL_PLATFORM_PROTECTION',
      platform,
      reason: 'YouTube mendeteksi akses otomatis dan menerapkan proteksi SABR (Signature Algorithm Boundary Reduction).',
      suggestions: [
        'Gunakan cookies YouTube yang fresh/valid (belum expired)',
        'Coba user-agent browser asli (Chrome/Firefox)',
        'Tambahkan delay 2-5 detik antar request',
        'Coba extractor arg: --extractor-args "youtube:player_client=android"',
        'Gunakan referer https://www.youtube.com/ untuk request',
        'Video tertentu memang tidak bisa di-download karena kebijakan YouTube'
      ],
      bypassStrategies: [
        {
          name: 'Fresh Cookies',
          description: 'Update cookies YouTube yang masih valid',
          implementation: 'Gunakan cookies dari login YouTube terbaru'
        },
        {
          name: 'Android Client',
          description: 'Gunakan android player client instead of web',
          implementation: '--extractor-args "youtube:player_client=android"'
        },
        {
          name: 'User-Agent Rotation',
          description: 'Randomize user-agent untuk hindari bot detection',
          implementation: '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"'
        },
        {
          name: 'Request Throttling',
          description: 'Tambahkan delay antar request',
          implementation: '--sleep-requests 2 --throttled-rate 100K'
        },
        {
          name: 'Referer Header',
          description: 'Set referer ke YouTube homepage',
          implementation: '--referer "https://www.youtube.com/"'
        }
      ],
      retryable: true,
      retryAfter: 600000,
      exitCode
    };
  }

  // 3. YOUTUBE - PRIVATE CONTENT
  if ((platform === 'youtube' || platform === 'youtubemusic') &&
      (errorText.includes('private video') ||
       errorText.includes('this video is private') ||
       errorText.includes('login to view') ||
       errorText.includes('sign in to view'))) {

    return {
      type: 'PRIVATE_CONTENT',
      platform,
      reason: 'Video YouTube bersifat private dan hanya bisa diakses oleh pemilik atau orang yang diundang.',
      suggestions: [
        'Pastikan video bersifat public',
        'Video private tidak bisa di-download',
        'Coba akses link di browser untuk konfirmasi',
        'Jika ini video Anda, buat menjadi public terlebih dahulu'
      ],
      retryable: false,
      exitCode
    };
  }

  // 4. SPOTIFY - DRM / AUTH ISSUES
  if (platform === 'spotify' &&
      (errorText.includes('drm') ||
       errorText.includes('token') ||
       httpStatus === 401 ||
       httpStatus === 403 ||
       errorText.includes('authentication'))) {

    return {
      type: 'AUTH_ISSUE',
      platform,
      reason: 'Spotify menggunakan proteksi DRM dan membutuhkan autentikasi yang valid.',
      suggestions: [
        'Spotify tidak bisa di-download langsung karena DRM',
        'Gunakan mode metadata-only untuk melihat info lagu',
        'Coba gunakan platform alternatif seperti YouTube untuk audio',
        'Spotify hanya bisa di-streaming melalui aplikasi resmi'
      ],
      retryable: false,
      exitCode: httpStatus || exitCode
    };
  }

  // 5. TIKTOK - IP BLOCKED
  if (platform === 'tiktok' &&
      (errorText.includes('ip address is blocked') ||
       errorText.includes('access denied') ||
       errorText.includes('forbidden') ||
       errorText.includes('your ip'))) {

    return {
      type: 'IP_BLOCKED',
      platform,
      reason: 'IP server dibatasi oleh TikTok karena terdeteksi sebagai bot atau aktivitas mencurigakan.',
      suggestions: [
        'Tunggu 1-24 jam sebelum mencoba lagi',
        'Gunakan koneksi internet yang berbeda',
        'Coba link TikTok yang berbeda (mungkin hanya video tertentu yang diblokir)',
        'Pastikan link yang dikirim adalah link public dan bisa diakses tanpa login'
      ],
      retryable: true,
      retryAfter: 3600000,
      exitCode: httpStatus || exitCode
    };
  }

  // 6. INSTAGRAM - PRIVATE/LOGIN REQUIRED
  if (platform === 'instagram' &&
      (errorText.includes('login') ||
       errorText.includes('private') ||
       errorText.includes('authentication required') ||
       httpStatus === 403)) {

    return {
      type: 'PRIVATE_CONTENT',
      platform,
      reason: 'Konten Instagram bersifat private atau membutuhkan login untuk diakses.',
      suggestions: [
        'Pastikan akun Instagram sudah login di browser',
        'Gunakan cookies Instagram yang valid',
        'Kirim link public yang bisa diakses tanpa login',
        'Video stories dan private posts tidak bisa di-download'
      ],
      retryable: false,
      exitCode: httpStatus || exitCode
    };
  }

  // 7. NETWORK ERRORS
  if (errorText.includes('timed out') ||
      errorText.includes('connection refused') ||
      errorText.includes('network error') ||
      errorText.includes('econnreset') ||
      errorText.includes('econnrefused') ||
      errorText.includes('enotfound') ||
      errorText.includes('etimedout')) {

    return {
      type: 'NETWORK_ERROR',
      platform,
      reason: 'Terjadi masalah koneksi jaringan saat mengakses platform.',
      suggestions: [
        'Periksa koneksi internet Anda',
        'Coba beberapa saat lagi',
        'Pastikan URL dapat diakses di browser',
        'Jika sering terjadi, mungkin ada firewall yang memblokir akses'
      ],
      retryable: true,
      exitCode
    };
  }

  // 8. USER INPUT ERROR - URL TIDAK VALID
  if (errorText.includes('not a valid url') ||
      errorText.includes('invalid url') ||
      errorText.includes('no video formats found') ||
      (!url && message) ||
      (url && !url.match(/^https?:\/\//))) {

    return {
      type: 'USER_INPUT_ERROR',
      platform: 'generic',
      reason: 'URL yang dikirim tidak valid atau tidak dapat diakses.',
      suggestions: [
        'Pastikan URL lengkap dan dimulai dengan http:// atau https://',
        'Copy URL langsung dari browser (bukan dari search bar aplikasi)',
        'Pastikan link dapat dibuka di browser sebelum dikirim',
        'Hindari teks acak atau partial URL',
        'Untuk playlist, coba kirim link video individual'
      ],
      retryable: false,
      exitCode
    };
  }

  // 8b. YOUTUBE COMMUNITY POST - NOT SUPPORTED
  if (url && url.includes('youtube.com/post/')) {
    return {
      type: 'UNSUPPORTED_PLATFORM',
      platform: 'youtube',
      reason: 'YouTube Community Post tidak didukung. Format URL post langsung tidak dapat diproses oleh yt-dlp.',
      suggestions: [
        'Gunakan link video/shorts/playlist YouTube yang valid',
        'Community Post hanya bisa diakses melalui tab Community di channel',
        'Coba cari video terkait dari post tersebut jika ada',
        'atau gunakan link format: https://www.youtube.com/channel/CHANNEL_ID/community?post=POST_ID'
      ],
      retryable: false,
      exitCode
    };
  }

  // 9. PLATFORM NOT SUPPORTED
  if (errorText.includes('platform not supported') ||
      errorText.includes('unsupported url') ||
      errorText.includes('no extractor')) {

    return {
      type: 'UNSUPPORTED_PLATFORM',
      platform: 'generic',
      reason: 'Platform belum didukung atau URL tidak recognized.',
      suggestions: [
        'Pastikan platform didukung (cek /api/platforms)',
        'Gunakan link direct dari platform yang didukung',
        'Hindari link shortened (bit.ly, tinyurl) - gunakan link asli',
        'Untuk Reddit, pastikan menggunakan reddit.com bukan redd.it'
      ],
      retryable: false,
      exitCode
    };
  }

  // 10. CONTENT UNAVAILABLE
  if (errorText.includes('video unavailable') ||
      errorText.includes('content not available') ||
      errorText.includes('deleted') ||
      errorText.includes('video removed') ||
      errorText.includes('unavailable')) {

    return {
      type: 'CONTENT_UNAVAILABLE',
      platform,
      reason: 'Konten telah dihapus, dijadikan private, atau tidak tersedia di region Anda.',
      suggestions: [
        'Pastikan konten masih public dan tersedia',
        'Video mungkin dihapus oleh pemilik',
        'Konten mungkin geo-blocked di region tertentu',
        'Coba akses link di browser untuk konfirmasi'
      ],
      retryable: false,
      exitCode
    };
  }

  // 11. INTERNAL ERROR - FFMPEG/MERGE ISSUES
  if (errorText.includes('ffmpeg') ||
      errorText.includes('codec') ||
      errorText.includes('merge') ||
      errorText.includes('mux')) {

    return {
      type: 'INTERNAL_ERROR',
      platform,
      reason: 'Terjadi kesalahan internal saat memproses media (merge/encode).',
      suggestions: [
        'Coba lagi dalam beberapa saat',
        'Video mungkin memiliki format yang tidak kompatibel',
        'Admin akan memeriksa log error untuk perbaikan',
        'Sebagai alternatif, coba quality yang berbeda (360p, 480p)'
      ],
      retryable: true,
      exitCode
    };
  }

  // 12. GENERIC EXTERNAL PLATFORM ERROR
  if (exitCode !== 0 || httpStatus >= 400) {
    return {
      type: 'EXTERNAL_PLATFORM_PROTECTION',
      platform,
      reason: getGenericPlatformReason(platform),
      suggestions: getGenericPlatformSuggestions(platform),
      retryable: false,
      exitCode: httpStatus || exitCode
    };
  }

  // 13. FALLBACK - UNKNOWN ERROR
  return {
    type: 'UNKNOWN_ERROR',
    platform,
    reason: 'Terjadi kesalahan yang tidak teridentifikasi.',
    suggestions: [
      'Coba lagi dalam beberapa saat',
      'Pastikan link valid dan dapat diakses di browser',
      'Jika masalah berlanjut, hubungi admin dengan menyertakan URL yang bermasalah'
    ],
    retryable: true,
    exitCode
  };
}

function getRateLimitReason(platform) {
  const reasons = {
    spotify: 'Spotify membatasi jumlah request API dalam waktu singkat.',
    youtube: 'YouTube membatasi frekuensi akses otomatis.',
    tiktok: 'TikTok membatasi request dari IP yang sama.',
    generic: 'Platform membatasi jumlah request untuk mencegah abuse.'
  };

  return reasons[platform] || reasons.generic;
}

function getRateLimitSuggestions(platform) {
  const suggestions = {
    spotify: [
      'Tunggu 1-5 menit sebelum mencoba lagi',
      'Kurangi frekuensi request ke Spotify',
      'Gunakan metadata-only untuk melihat info lagu tanpa download',
      'Spotify memiliki rate limit ketat, bersabarlah'
    ],
    youtube: [
      'Tunggu 1-3 menit sebelum retry',
      'Hindari request berurutan ke YouTube',
      'Gunakan mode metadata untuk info video',
      'YouTube membatasi bot detection'
    ],
    tiktok: [
      'Tunggu 10-30 menit',
      'TikTok sangat ketat dengan anti-bot',
      'Coba gunakan link video yang berbeda',
      'Pertimbangkan menggunakan platform alternatif'
    ],
    generic: [
      'Tunggu beberapa menit',
      'Kurangi frekuensi request',
      'Jangan spam request',
      'Rate limit akan reset otomatis'
    ]
  };

  return suggestions[platform] || suggestions.generic;
}

function getRetryAfter(platform) {
  const retryMap = {
    spotify: 300000, // 5 minutes
    youtube: 180000, // 3 minutes
    tiktok: 600000, // 10 minutes
    generic: 60000  // 1 minute
  };

  return retryMap[platform] || 60000;
}

function getGenericPlatformReason(platform) {
  const reasons = {
    instagram: 'Instagram menerapkan proteksi untuk mencegah scraping otomatis.',
    facebook: 'Facebook membatasi akses otomatis ke konten.',
    twitter: 'Twitter/X memiliki proteksi anti-bot yang ketat.',
    pinterest: 'Pinterest membatasi request otomatis.'
  };

  return reasons[platform] || 'Platform menerapkan pembatasan akses otomatis.';
}

function getGenericPlatformSuggestions(platform) {
  const suggestions = {
    instagram: [
      'Pastikan link Instagram public dan bisa diakses tanpa login',
      'Gunakan cookies Instagram yang valid',
      'Stories dan private posts tidak bisa di-download',
      'Tunggu beberapa menit jika rate limited'
    ],
    facebook: [
      'Pastikan video Facebook public',
      'Link harus bisa diakses tanpa login',
      'Facebook sering mengubah proteksi mereka',
      'Video live tidak bisa di-download'
    ],
    twitter: [
      'Pastikan tweet/video public',
      'Twitter/X memiliki proteksi ketat',
      'Gunakan link langsung ke video',
      'Video yang di-delete tidak bisa diakses'
    ],
    pinterest: [
      'Pastikan pin public',
      'Pinterest lebih longgar dibanding platform lain',
      'Video Pinterest biasanya bisa di-download',
      'Try again jika pertama gagal'
    ]
  };

  return suggestions[platform] || [
    'Pastikan konten public dan dapat diakses',
    'Coba beberapa saat lagi',
    'Platform mungkin sedang maintenance',
    'Jika sering gagal, gunakan platform alternatif'
  ];
}

/**
 * Check if error indicates success (for cases where exit code 0 but no files)
 */
export function isSuccessWithNoFiles(stderr, stdout) {
  const text = `${stderr} ${stdout}`.toLowerCase();
  return text.includes('has already been downloaded') ||
         text.includes('exists') ||
         text.includes('skipping');
}

/**
 * Extract HTTP status code from error message
 */
export function extractHttpStatus(errorText) {
  const match = errorText.match(/HTTP (\d+)/) || errorText.match(/status (\d+)/);
  return match ? parseInt(match[1]) : null;
}