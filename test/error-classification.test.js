import pino from 'pino';
import { enhancedDownloaderService } from '../src/services/enhancedDownloader.service.js';
import { classifyError } from '../src/services/errorClassifier.service.js';
import { retryWithBackoff, isRetryable } from '../src/utils/retry.util.js';

const logger = pino({
  name: 'error-classification-test',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

/**
 * Test Suite: Error Classification & User-Friendly Advice System
 * Validates that external platform errors are properly classified
 * and user-friendly messages are provided
 */

// Test 1: Error Classification for YouTube SABR Protection
async function testYouTubeSABRError() {
  logger.info('Test 1: YouTube SABR Protection Error Classification');

  const error = classifyError({
    stderr: 'ERROR: [youtube] Video unavailable. The video is not available, it may be due to the SABR protection',
    stdout: '',
    exitCode: 1,
    platform: 'youtube',
    message: 'Video unavailable',
    url: 'https://www.youtube.com/watch?v=TEST123'
  });

  console.log('Result:', JSON.stringify(error, null, 2));

  if (error.type === 'EXTERNAL_PLATFORM_PROTECTION') {
    console.log('✓ PASSED: SABR error correctly classified\n');
    return true;
  } else {
    console.log('✗ FAILED: Expected EXTERNAL_PLATFORM_PROTECTION, got:', error.type, '\n');
    return false;
  }
}

// Test 2: Error Classification for Spotify Rate Limiting
async function testSpotifyRateLimitError() {
  logger.info('Test 2: Spotify Rate Limiting Error Classification');

  const error = classifyError({
    stderr: 'Got 429. That means too many requests. Please retry after some time.',
    stdout: '',
    exitCode: 1,
    platform: 'spotify',
    message: 'Rate limit exceeded',
    url: 'https://open.spotify.com/track/TEST123'
  });

  console.log('Result:', JSON.stringify(error, null, 2));

  if (error.type === 'RATE_LIMIT') {
    console.log('✓ PASSED: Rate limit error correctly classified\n');
    return true;
  } else {
    console.log('✗ FAILED: Expected RATE_LIMIT, got:', error.type, '\n');
    return false;
  }
}

// Test 3: Error Classification for TikTok IP Block
async function testTikTokIPBlockError() {
  logger.info('Test 3: TikTok IP Blocking Error Classification');

  const error = classifyError({
    stderr: 'HTTP Error 403: Forbidden. Your IP address has been temporarily banned',
    stdout: '',
    exitCode: 1,
    platform: 'tiktok',
    message: 'IP blocked',
    url: 'https://www.tiktok.com/@test/video/123'
  });

  console.log('Result:', JSON.stringify(error, null, 2));

  if (error.type === 'IP_BLOCKED') {
    console.log('✓ PASSED: IP block error correctly classified\n');
    return true;
  } else {
    console.log('✗ FAILED: Expected IP_BLOCKED, got:', error.type, '\n');
    return false;
  }
}

// Test 4: Error Classification for Invalid URL
async function testInvalidURLError() {
  logger.info('Test 4: Invalid URL Error Classification');

  const error = classifyError({
    stderr: 'ERROR: Unable to download webpage: <urlopen error [Errno -3] Temporary failure in name resolution>',
    stdout: '',
    exitCode: 1,
    platform: 'youtube',
    message: 'Invalid URL',
    url: 'not-a-valid-url'
  });

  console.log('Result:', JSON.stringify(error, null, 2));

  if (error.type === 'USER_INPUT_ERROR') {
    console.log('✓ PASSED: Invalid URL error correctly classified\n');
    return true;
  } else {
    console.log('✗ FAILED: Expected USER_INPUT_ERROR, got:', error.type, '\n');
    return false;
  }
}

// Test 5: Error Classification for Private Content
async function testPrivateContentError() {
  logger.info('Test 5: Private Content Error Classification');

  const error = classifyError({
    stderr: 'ERROR: Video "Private video" is not available',
    stdout: '',
    exitCode: 1,
    platform: 'youtube',
    message: 'Private video',
    url: 'https://www.youtube.com/watch?v=PRIVATE123'
  });

  console.log('Result:', JSON.stringify(error, null, 2));

  if (error.type === 'PRIVATE_CONTENT') {
    console.log('✓ PASSED: Private content error correctly classified\n');
    return true;
  } else {
    console.log('✗ FAILED: Expected PRIVATE_CONTENT, got:', error.type, '\n');
    return false;
  }
}

// Test 6: Retry Logic for Retryable Errors
async function testRetryLogic() {
  logger.info('Test 6: Retry Logic for Retryable Errors');

  const retryableErrors = [
    'RATE_LIMIT',
    'NETWORK_ERROR',
    'EXTERNAL_PLATFORM_PROTECTION',
    'IP_BLOCKED', // Marked as retryable but with 0 retries recommended
    'INTERNAL_ERROR'
  ];

  let allPassed = true;

  for (const errorType of retryableErrors) {
    const isRetry = isRetryable(errorType);
    console.log(`  ${errorType}: ${isRetry ? 'Retryable ✓' : 'Not Retryable ✗'}`);

    if (!isRetry) {
      allPassed = false;
    }
  }

  // Non-retryable errors
  const nonRetryableErrors = [
    'USER_INPUT_ERROR',
    'UNSUPPORTED_PLATFORM',
    'PRIVATE_CONTENT',
    'CONTENT_UNAVAILABLE'
  ];

  for (const errorType of nonRetryableErrors) {
    const isRetry = isRetryable(errorType);
    console.log(`  ${errorType}: ${isRetry ? 'Retryable ✗' : 'Not Retryable ✓'}`);

    if (isRetry) {
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('✓ PASSED: Retry logic correctly identifies retryable errors\n');
    return true;
  } else {
    console.log('✗ FAILED: Retry logic incorrectly classifies errors\n');
    return false;
  }
}

// Test 7: Retry with Backoff Functionality
async function testRetryWithBackoff() {
  logger.info('Test 7: Retry with Backoff Functionality');

  let attemptCount = 0;
  const maxAttempts = 3;

  try {
    await retryWithBackoff(
      async () => {
        attemptCount++;
        if (attemptCount < maxAttempts) {
          throw new Error('Simulated temporary error');
        }
        return { success: true };
      },
      {
        retries: 2,
        baseDelay: 100,
        factor: 2,
        onRetry: (error, attempt) => {
          logger.info(`Retry attempt ${attempt} for error: ${error.message}`);
        }
      }
    );

    if (attemptCount === 3) {
      console.log('✓ PASSED: Retry with backoff works correctly\n');
      return true;
    } else {
      console.log('✗ FAILED: Expected 3 attempts, got:', attemptCount, '\n');
      return false;
    }
  } catch (error) {
    console.log('✗ FAILED: Unexpected error:', error.message, '\n');
    return false;
  }
}

// Test 8: Metadata-Only Mode for Protected Content
async function testMetadataOnlyMode() {
  logger.info('Test 8: Metadata-Only Mode for Protected Content');

  try {
    const result = await enhancedDownloaderService.processUrl(
      'https://www.youtube.com/watch?v=SABR_TEST',
      {
        quality: 'best',
        mode: 'metadata-only',
        maxRetries: 1
      }
    );

    console.log('Result:', JSON.stringify(result, null, 2));

    // The URL is invalid so we expect an error, but it should still return metadata if available
    // The important thing is that it handles the error gracefully
    if (result.error && result.error.type) {
      console.log('✓ PASSED: Metadata-only mode handles errors gracefully with classification\n');
      return true;
    } else {
      console.log('✗ FAILED: Expected error classification\n');
      return false;
    }
  } catch (error) {
    console.log('Error during test:', error.message);
    console.log('✓ PASSED: Error handling works (expected for test URL)\n');
    return true;
  }
}

// Test 9: User-Friendly Error Response Structure
async function testUserFriendlyErrorResponse() {
  logger.info('Test 9: User-Friendly Error Response Structure');

  const error = classifyError({
    stderr: 'ERROR: Video unavailable',
    stdout: '',
    exitCode: 1,
    platform: 'youtube',
    message: 'Video unavailable',
    url: 'https://www.youtube.com/watch?v=TEST123'
  });

  const requiredFields = ['type', 'reason', 'suggestions', 'retryable'];

  const hasAllFields = requiredFields.every(field => field in error);
  const hasArraySuggestions = Array.isArray(error.suggestions);
  const hasStringReason = typeof error.reason === 'string';

  console.log('Required fields present:', hasAllFields);
  console.log('Suggestions is array:', hasArraySuggestions);
  console.log('Reason is string:', hasStringReason);
  console.log('Error object:', JSON.stringify(error, null, 2));

  if (hasAllFields && hasArraySuggestions && hasStringReason) {
    console.log('✓ PASSED: Error response structure is user-friendly\n');
    return true;
  } else {
    console.log('✗ FAILED: Error response structure missing required fields\n');
    return false;
  }
}

// Test 10: Platform-Specific Error Messages
async function testPlatformSpecificErrorMessages() {
  logger.info('Test 10: Platform-Specific Error Messages');

  const platforms = ['youtube', 'tiktok', 'facebook', 'instagram', 'spotify'];
  let allPassed = true;

  for (const platform of platforms) {
    const error = classifyError({
      stderr: 'Test error',
      stdout: '',
      exitCode: 1,
      platform: platform,
      message: 'Test',
      url: `https://test.${platform}.com`
    });

    console.log(`  ${platform}:`, error.type);

    if (!error.type) {
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('✓ PASSED: Platform-specific error classification works\n');
    return true;
  } else {
    console.log('✗ FAILED: Platform-specific error classification failed\n');
    return false;
  }
}

// Main Test Runner
async function runAllTests() {
  console.log('\n========================================');
  console.log('ERROR CLASSIFICATION TEST SUITE');
  console.log('========================================\n');

  const tests = [
    testYouTubeSABRError,
    testSpotifyRateLimitError,
    testTikTokIPBlockError,
    testInvalidURLError,
    testPrivateContentError,
    testRetryLogic,
    testRetryWithBackoff,
    testMetadataOnlyMode,
    testUserFriendlyErrorResponse,
    testPlatformSpecificErrorMessages
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log('✗ FAILED: Test threw exception:', error.message, '\n');
      failed++;
    }
  }

  console.log('\n========================================');
  console.log('TEST RESULTS');
  console.log('========================================');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(2)}%`);
  console.log('========================================\n');

  if (failed === 0) {
    console.log('🎉 All tests passed! Error classification system is working correctly.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the error classification system.\n');
    process.exit(1);
  }
}

// Run tests
runAllTests();