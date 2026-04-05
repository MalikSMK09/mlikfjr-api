import crypto from 'crypto';

// UUID Generator Service
export const uuidService = {
  generate(version = 4) {
    // UUID v4 random generation
    const uuid = crypto.randomUUID();
    return {
      success: true,
      data: {
        uuid,
        version: 4,
        variant: 'RFC 4122'
      }
    };
  },

  validate(uuid) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return {
      success: true,
      data: {
        valid: regex.test(uuid),
        uuid: uuid
      }
    };
  }
};

export default uuidService;
