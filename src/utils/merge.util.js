import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import pino from 'pino';

const logger = pino({
  name: 'merge-util',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

/**
 * Merge video and audio files using ffmpeg
 * @param {string} videoPath - Path to video file
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Path for merged output
 * @param {Object} options - Merge options
 * @returns {Promise<Object>} - Result with success flag and file info
 */
export async function mergeVideoAudio(videoPath, audioPath, outputPath, options = {}) {
  const { quality = 'high', cleanup = true } = options;

  // Ensure output directory exists
  await fs.ensureDir(path.dirname(outputPath));

  logger.info({
    videoPath,
    audioPath,
    outputPath
  }, 'Starting video/audio merge');

  // Strategy 1: Copy video stream, re-encode audio to AAC
  try {
    await executeFfmpeg([
      '-y',
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',  // Copy video stream without re-encoding
      '-c:a', 'aac',   // Encode audio to AAC
      '-b:a', '192k',  // Audio bitrate
      '-map', '0:v:0', // Map video from first input
      '-map', '1:a:0', // Map audio from second input
      '-shortest',     // Stop when shortest stream ends
      outputPath
    ]);

    logger.info({
      outputPath
    }, 'Video/audio merge successful (copy video, encode audio)');

    const stats = await fs.stat(outputPath);
    return {
      success: true,
      path: outputPath,
      size: stats.size,
      strategy: 'copy-video-encode-audio'
    };
  } catch (error) {
    logger.warn({
      error: error.message,
      videoPath,
      audioPath
    }, 'First merge strategy failed, trying fallback');

    // Strategy 2: Re-encode both video and audio if codec incompatible
    try {
      await executeFfmpeg([
        '-y',
        '-i', videoPath,
        '-i', audioPath,
        '-c:v', 'libx264',  // Re-encode video to H.264
        '-preset', quality === 'high' ? 'medium' : 'fast',
        '-crf', '23',       // Quality setting
        '-c:a', 'aac',      // Encode audio to AAC
        '-b:a', '192k',     // Audio bitrate
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        outputPath
      ]);

      logger.info({
        outputPath
      }, 'Video/audio merge successful (re-encode both)');

      const stats = await fs.stat(outputPath);
      return {
        success: true,
        path: outputPath,
        size: stats.size,
        strategy: 're-encode-both'
      };
    } catch (error2) {
      logger.error({
        error: error2.message,
        videoPath,
        audioPath
      }, 'Second merge strategy failed');

      // Strategy 3: Simple concat without re-encoding (for same codec)
      try {
        await executeFfmpeg([
          '-y',
          '-i', videoPath,
          '-i', audioPath,
          '-c', 'copy',
          '-shortest',
          outputPath
        ]);

        logger.info({
          outputPath
        }, 'Video/audio merge successful (copy streams)');

        const stats = await fs.stat(outputPath);
        return {
          success: true,
          path: outputPath,
          size: stats.size,
          strategy: 'copy-streams'
        };
      } catch (error3) {
        logger.error({
          error: error3.message,
          videoPath,
          audioPath
        }, 'All merge strategies failed');

        throw new Error(`Failed to merge video and audio after 3 strategies: ${error3.message}`);
      }
    }
  } finally {
    // Cleanup temporary files if requested
    if (cleanup) {
      try {
        await fs.remove(videoPath);
        await fs.remove(audioPath);
        logger.debug('Temporary files cleaned up');
      } catch (cleanupError) {
        logger.warn({
          error: cleanupError.message
        }, 'Failed to cleanup temporary files');
      }
    }
  }
}

/**
 * Execute ffmpeg command with timeout
 * @param {Array<string>} args - FFmpeg arguments
 * @param {number} timeout - Timeout in milliseconds (default: 300000 = 5 minutes)
 * @returns {Promise<void>}
 */
function executeFfmpeg(args, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';
    let stdout = '';

    const timeoutHandle = setTimeout(() => {
      ffmpeg.kill('SIGKILL');
      reject(new Error(`FFmpeg execution timeout after ${timeout}ms`));
    }, timeout);

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffmpeg.on('close', (code) => {
      clearTimeout(timeoutHandle);

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const errorMsg = extractFfmpegError(stderr) || `FFmpeg exited with code ${code}`;
        reject(new Error(errorMsg));
      }
    });

    ffmpeg.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to execute FFmpeg: ${error.message}`));
    });
  });
}

/**
 * Extract meaningful error message from ffmpeg stderr
 * @param {string} stderr - FFmpeg stderr output
 * @returns {string} - Formatted error message
 */
function extractFfmpegError(stderr) {
  if (!stderr) return null;

  // Common error patterns
  const patterns = [
    /error: (.+)/i,
    /failed: (.+)/i,
    /invalid (.+)/i,
    /(.+) (not found|not supported)/i,
    /could not write header/i,
    /moov atom not found/i,
    / Invalid data found when processing input/i
  ];

  for (const pattern of patterns) {
    const match = stderr.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  // Return last line if it contains "Error" or "Failed"
  const lines = stderr.split('\n').filter(line => line.trim());
  const lastLine = lines[lines.length - 1];

  if (lastLine && (lastLine.includes('Error') || lastLine.includes('Failed'))) {
    return lastLine.trim();
  }

  return stderr.split('\n').find(line => line.includes('Error')) || null;
}

/**
 * Check if file has both video and audio streams
 * @param {string} filePath - Path to media file
 * @returns {Promise<Object>} - Stream information
 */
export async function getMediaInfo(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      filePath
    ]);

    let stderr = '';
    let stdout = '';

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          const videoStreams = info.streams.filter(s => s.codec_type === 'video');
          const audioStreams = info.streams.filter(s => s.codec_type === 'audio');

          resolve({
            hasVideo: videoStreams.length > 0,
            hasAudio: audioStreams.length > 0,
            videoCodec: videoStreams[0]?.codec_name,
            audioCodec: audioStreams[0]?.codec_name,
            duration: parseFloat(info.format.duration || 0)
          });
        } catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
        }
      } else {
        reject(new Error(`ffprobe failed: ${stderr}`));
      }
    });

    ffprobe.on('error', (error) => {
      reject(new Error(`Failed to execute ffprobe: ${error.message}`));
    });
  });
}

/**
 * Get file mime type based on extension
 * @param {string} filename - Name of the file
 * @returns {string} - MIME type
 */
export function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/opus',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  };

  return mimeTypes[ext] || 'application/octet-stream';
}