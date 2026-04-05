import pino from 'pino';

const logger = pino({
  name: 'retry-util',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry configuration
 * @param {number} options.retries - Maximum retry attempts (default: 2)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.factor - Backoff factor (default: 2)
 * @param {Function} options.onRetry - Callback on retry with (error, attemptNumber)
 * @returns {Promise} - Result of successful execution
 */
export async function retryWithBackoff(
  fn,
  {
    retries = 2,
    baseDelay = 1000,
    factor = 2,
    onRetry = null
  } = {}
) {
  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = await fn(attempt);
      return {
        success: true,
        data: result,
        attempts: attempt
      };
    } catch (error) {
      lastError = error;

      if (attempt <= retries) {
        const delay = baseDelay * Math.pow(factor, attempt - 1);

        logger.warn({
          attempt,
          maxRetries: retries + 1,
          delay,
          error: error.message || error
        }, 'Retry attempt failed, retrying...');

        if (onRetry) {
          onRetry(error, attempt);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error({
    attempts: retries + 1,
    error: lastError.message || lastError
  }, 'All retry attempts exhausted');

  return {
    success: false,
    error: lastError,
    attempts: retries + 1
  };
}

/**
 * Check if an error is retryable based on its classification
 * @param {string} errorType - Error type from classifier
 * @returns {boolean} - Whether the error is retryable
 */
export function isRetryable(errorType) {
  const retryableTypes = [
    'RATE_LIMIT',
    'NETWORK_ERROR',
    'TEMPORARY_UNAVAILABLE',
    'EXTERNAL_PLATFORM_PROTECTION',
    'IP_BLOCKED',
    'INTERNAL_ERROR'
  ];

  return retryableTypes.includes(errorType);
}

/**
 * Get appropriate retry count based on error type
 * @param {string} errorType - Error type from classifier
 * @returns {number} - Recommended retry count
 */
export function getRecommendedRetries(errorType) {
  const retryMap = {
    'RATE_LIMIT': 1, // Limited retries for rate limits
    'NETWORK_ERROR': 3,
    'TEMPORARY_UNAVAILABLE': 2,
    'EXTERNAL_PLATFORM_PROTECTION': 1, // Retry after waiting
    'IP_BLOCKED': 0, // Don't retry, wait for unblock
    'USER_INPUT_ERROR': 0, // Never retry
    'UNSUPPORTED_PLATFORM': 0, // Never retry
    'PRIVATE_CONTENT': 0, // Never retry
    'CONTENT_UNAVAILABLE': 0, // Never retry
    'INTERNAL_ERROR': 2 // Retry for internal errors
  };

  return retryMap[errorType] || 2;
}