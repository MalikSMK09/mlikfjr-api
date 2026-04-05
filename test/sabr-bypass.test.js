import { sabrBypassUtil } from '../src/utils/sabrBypass.util.js';

/**
 * Test SABR Bypass Utility
 */
console.log('=== SABR BYPASS UTILITY TEST ===\n');

// Test 1: Generate bypass args for first attempt
console.log('Test 1: First Attempt (Android Client)');
const args1 = sabrBypassUtil.generateBypassArgs({
  cookies: 'cookies/youtube.txt',
  retryCount: 0,
  quality: 'best'
});
console.log('Args:', args1.join(' '));
console.log('');

// Test 2: Generate bypass args for retry (rotated UA)
console.log('Test 2: Retry Attempt (Rotated User-Agent)');
const args2 = sabrBypassUtil.generateBypassArgs({
  cookies: 'cookies/youtube.txt',
  retryCount: 1,
  quality: 'best'
});
console.log('Args:', args2.join(' '));
console.log('');

// Test 3: Get bypass delay
console.log('Test 3: Bypass Delays');
for (let i = 0; i < 4; i++) {
  const delay = sabrBypassUtil.getBypassDelay(i);
  console.log(`Retry ${i}: ${delay}ms (${(delay/1000).toFixed(1)}s)`);
}
console.log('');

// Test 4: URL risk analysis
console.log('Test 4: URL Risk Analysis');
const testUrls = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://music.youtube.com/watch?v=test123',
  'https://youtube.com/shorts/test456'
];

testUrls.forEach(url => {
  const isHighRisk = sabrBypassUtil.isHighRiskUrl(url);
  console.log(`${isHighRisk ? '⚠️' : '✅'} ${url.substring(0, 60)}...`);
});
console.log('');

// Test 5: Get stats
console.log('Test 5: Bypass Stats');
console.log(JSON.stringify(sabrBypassUtil.getStats(), null, 2));

console.log('\n✅ All SABR bypass tests completed!');
