/**
 * Spotify Downloader Wrapper
 * Calls Python yt-dlp for Spotify downloads (bypasses DRM)
 *
 * Usage:
 *   node spotify_downloader.cjs <spotify_url>
 *   node spotify_downloader.cjs "https://open.spotify.com/track/xxx"
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPT_DIR = path.dirname(__filename);
const PYTHON_SCRIPT = path.join(SCRIPT_DIR, 'spotify_downloader.py');
const OUTPUT_DIR = path.join(__dirname, '..', 'downloads');

/**
 * Get Python executable
 */
function getPython() {
    const pythonVersions = ['python3', 'python', 'py'];
    for (const py of pythonVersions) {
        try {
            const result = execSync(`${py} --version`, { encoding: 'utf-8', timeout: 5000 });
            if (result.includes('Python 3')) return py;
        } catch { continue; }
    }
    return 'python';
}

/**
 * Run Spotify downloader
 */
async function downloadSpotify(url, options = {}) {
    return new Promise((resolve) => {
        const python = getPython();
        const args = [PYTHON_SCRIPT, url];

        console.log('\n🎵 Platform: Spotify');
        console.log('🔍 Fetching track data...');

        // Use spawn for real-time output
        const proc = spawn(python, args, {
            cwd: SCRIPT_DIR,
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            const text = data.toString();
            stdout += text;
            process.stdout.write(text);
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                // Find downloaded file
                const files = fs.readdirSync(OUTPUT_DIR)
                    .filter(f => f.endsWith('.mp3') || f.endsWith('.m4a'))
                    .sort((a, b) => fs.statSync(path.join(OUTPUT_DIR, b)).mtime - fs.statSync(path.join(OUTPUT_DIR, a)).mtime);

                if (files.length > 0) {
                    const latest = files[0];
                    const filePath = path.join(OUTPUT_DIR, latest);
                    const stats = fs.statSync(filePath);

                    resolve({
                        platform: 'spotify',
                        title: extractTitle(stdout),
                        uploader: extractArtist(stdout),
                        mediaItems: [{
                            type: 'audio',
                            url: filePath,
                            extension: path.extname(latest).replace('.', ''),
                            description: 'Audio (Spotify)'
                        }],
                        success: true
                    });
                } else {
                    resolve({
                        platform: 'spotify',
                        mediaItems: [],
                        error: 'Download completed but file not found',
                        success: false
                    });
                }
            } else {
                resolve({
                    platform: 'spotify',
                    mediaItems: [],
                    error: stderr || 'Download failed',
                    success: false
                });
            }
        });

        proc.on('error', (err) => {
            resolve({
                platform: 'spotify',
                mediaItems: [],
                error: err.message,
                success: false
            });
        });
    });
}

/**
 * Extract title from output
 */
function extractTitle(output) {
    const match = output.match(/Title:\s*(.+)/);
    return match ? match[1].trim() : 'Spotify Track';
}

/**
 * Extract artist from output
 */
function extractArtist(output) {
    const match = output.match(/Artist:\s*(.+)/);
    return match ? match[1].trim() : 'Unknown Artist';
}

/**
 * Main function when run directly
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               Spotify Downloader (Node.js Wrapper)             ║
╠═══════════════════════════════════════════════════════════════╣
║  Uses Python yt-dlp for DRM-bypassed downloads                 ║
║  Supports: Tracks, Albums, Playlists, Episodes                 ║
╠═══════════════════════════════════════════════════════════════╣
║  Usage: node spotify_downloader.cjs <spotify_url>              ║
║  Example: node spotify_downloader.cjs                          ║
║           "https://open.spotify.com/track/xyz123"              ║
╚═══════════════════════════════════════════════════════════════╝
        `);
        process.exit(1);
    }

    const url = args[0];

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    try {
        const result = await downloadSpotify(url);

        if (result.success) {
            console.log('\n' + '='.repeat(60));
            console.log('  Download Complete');
            console.log('='.repeat(60));
        } else {
            console.log('\n⚠ Download failed');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = { downloadSpotify };

// Run if called directly
if (require.main === module) {
    main();
}
