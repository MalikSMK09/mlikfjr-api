import crypto from 'crypto';

// Base64 Encode/Decode Service
export const base64Service = {
  encode(text) {
    try {
      const encoded = Buffer.from(text, 'utf8').toString('base64');
      return {
        success: true,
        data: {
          input: text,
          output: encoded,
          action: 'encode'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  decode(base64String) {
    try {
      const decoded = Buffer.from(base64String, 'base64').toString('utf8');
      // Check if decoded result is valid UTF-8
      const isValidUtf8 = decoded.length > 0;
      return {
        success: true,
        data: {
          input: base64String,
          output: decoded,
          action: 'decode',
          isValidUtf8
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid base64 string'
      };
    }
  },

  encodeUrlSafe(text) {
    try {
      const encoded = Buffer.from(text, 'utf8').toString('base64url');
      return {
        success: true,
        data: {
          input: text,
          output: encoded,
          action: 'encode_url_safe'
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

export default base64Service;
