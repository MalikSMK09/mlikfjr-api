import { spawn } from 'child_process';
import pino from 'pino';
import path from 'path';

const logger = pino({
  name: 'spotdl-service',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export class SpotdlService {
  constructor() {
    this.outputDir = 'downloads';
  }

  async download(url, options = {}) {
    const { outputDir = this.outputDir } = options;

    return new Promise((resolve) => {
      const args = [
        'download',
        url,
        '--output', outputDir,
        '--format', 'mp3'
      ];

      logger.info({ url, args: args.join(' ') }, 'Running spotdl command');

      const spotdl = spawn('spotdl', args);
      const files = [];
      let output = '';
      let errorOutput = '';

      spotdl.stdout.on('data', (data) => {
        const dataStr = data.toString();
        output += dataStr;
        logger.debug({ output: dataStr }, 'spotdl stdout');

        // Match both "Downloaded:" and "Skipping ... (file already exists)"
        const downloadMatch = dataStr.match(/Downloaded:\s+(.+)/);
        const skipMatch = dataStr.match(/Skipping\s+(.+?)\s+\(file already exists\)/);

        if (downloadMatch) {
          const filename = downloadMatch[1].trim();
          files.push({
            filename,
            path: path.join(outputDir, filename)
          });
          logger.info({ filename }, 'Downloaded file');
        } else if (skipMatch) {
          const filename = skipMatch[1].trim();
          files.push({
            filename,
            path: path.join(outputDir, filename)
          });
          logger.info({ filename }, 'File already exists (skipped)');
        }
      });

      spotdl.stderr.on('data', (data) => {
        const error = data.toString();
        errorOutput += error;
        logger.debug({ error }, 'spotdl stderr');
      });

      spotdl.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            files: files.length > 0 ? files : [],
            error: null
          });
        } else {
          resolve({
            success: false,
            files: [],
            error: errorOutput || `spotdl exited with code ${code}`
          });
        }
      });

      spotdl.on('error', (error) => {
        logger.error({ error: error.message }, 'Failed to start spotdl');
        resolve({
          success: false,
          files: [],
          error: `Failed to start spotdl: ${error.message}`
        });
      });
    });
  }

  async search(query, options = {}) {
    const { limit = 10 } = options;

    return new Promise((resolve) => {
      const args = [
        'spotdl',
        'search',
        query,
        '--limit', limit.toString()
      ];

      logger.info({ query, limit }, 'Running spotdl search');

      const spotdl = spawn('spotdl', args);
      let output = '';
      let errorOutput = '';

      spotdl.stdout.on('data', (data) => {
        output += data.toString();
      });

      spotdl.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      spotdl.on('close', (code) => {
        if (code === 0) {
          try {
            const lines = output.trim().split('\n');
            const results = lines.filter(line => line.trim()).map(line => {
              try {
                return JSON.parse(line);
              } catch {
                return { title: line.trim(), url: null };
              }
            });

            resolve({
              success: true,
              data: results,
              error: null
            });
          } catch (error) {
            resolve({
              success: false,
              data: [],
              error: `Failed to parse search results: ${error.message}`
            });
          }
        } else {
          resolve({
            success: false,
            data: [],
            error: errorOutput || `spotdl search exited with code ${code}`
          });
        }
      });

      spotdl.on('error', (error) => {
        resolve({
          success: false,
          data: [],
          error: `Failed to start spotdl search: ${error.message}`
        });
      });
    });
  }

  async checkSpotdlInstalled() {
    return new Promise((resolve) => {
      const process = spawn('spotdl', ['--version']);

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }
}

export const spotdlService = new SpotdlService();