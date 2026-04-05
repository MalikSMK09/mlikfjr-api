import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('\n🔍 Checking Masukkan Nama Media Downloader API Setup...\n');

const checkYtDlp = () => {
  return new Promise((resolve) => {
    console.log('📦 Checking yt-dlp installation...');
    const process = spawn('yt-dlp', ['--version']);

    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ yt-dlp is installed (Version: ${output.trim()})\n`);
        resolve(true);
      } else {
        console.log('❌ yt-dlp is not installed or not in PATH\n');
        console.log('Please install yt-dlp:\n');
        console.log('  Using pip:');
        console.log('    pip install yt-dlp\n');
        console.log('  Or download from:');
        console.log('    https://github.com/yt-dlp/yt-dlp#installation\n');
        resolve(false);
      }
    });

    process.on('error', (error) => {
      console.log('❌ Error checking yt-dlp:', error.message);
      console.log('\nPlease install yt-dlp:\n');
      console.log('  pip install yt-dlp\n');
      resolve(false);
    });
  });
};

const checkFolders = () => {
  const folders = [
    { name: 'cookies', required: false },
    { name: 'downloads', required: true },
    { name: 'scripts', required: true }
  ];

  console.log('📁 Checking directories...');
  let allGood = true;

  folders.forEach(folder => {
    if (!fs.existsSync(folder.name)) {
      console.log(`   Creating folder: ${folder.name}`);
      fs.mkdirSync(folder.name, { recursive: true });
    } else {
      console.log(`   ✅ Folder exists: ${folder.name}`);
    }
  });

  console.log('');
  return allGood;
};

const checkCookies = () => {
  console.log('🍪 Checking cookie files...');
  const cookieFiles = [
    'youtube.txt',
    'youtubemusic.txt',
    'spotify.txt',
    'instagram.txt',
    'threads.txt',
    'tiktok.txt',
    'twitter.txt',
    'facebook.txt',
    'pinterest.txt',
    'reddit.txt',
    'fandom.txt'
  ];

  cookieFiles.forEach(file => {
    const filePath = path.join('cookies', file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`   ✅ ${file} (${stats.size} bytes)`);
    } else {
      console.log(`   ⚪ ${file} (not found - optional)`);
    }
  });

  console.log('');
};

const main = async () => {
  const ytDlpInstalled = await checkYtDlp();
  checkFolders();
  checkCookies();

  console.log('='.repeat(50));

  if (ytDlpInstalled) {
    console.log('✅ All checks passed! You can now run the server with:');
    console.log('   npm start\n');
    console.log('📚 API Documentation:');
    console.log('   Health Check: GET /api/health');
    console.log('   Download: POST /api/download');
    console.log('   Platforms: GET /api/platforms\n');
  } else {
    console.log('⚠️  Please install yt-dlp before running the server.\n');
  }

  console.log('='.repeat(50));
  console.log('');
};

main();