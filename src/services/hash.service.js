import crypto from 'crypto';

// Hash Service - supports various algorithms
export const hashService = {
  algorithms: ['sha256', 'sha512', 'sha1', 'md5', 'sha3-256', 'sha3-512'],

  hash(input, algorithm = 'sha256') {
    if (!this.algorithms.includes(algorithm)) {
      return {
        success: false,
        error: 'Unsupported algorithm',
        supportedAlgorithms: this.algorithms
      };
    }

    try {
      const hash = crypto.createHash(algorithm).update(input, 'utf8').digest('hex');
      return {
        success: true,
        data: {
          input,
          algorithm,
          hash,
          encoded: hash
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  hashFile(buffer, algorithm = 'sha256') {
    if (!this.algorithms.includes(algorithm)) {
      return {
        success: false,
        error: 'Unsupported algorithm',
        supportedAlgorithms: this.algorithms
      };
    }

    try {
      const hash = crypto.createHash(algorithm).update(buffer).digest('hex');
      return {
        success: true,
        data: {
          algorithm,
          hash,
          length: buffer.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

export default hashService;
