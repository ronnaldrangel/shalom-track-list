require('dotenv').config();
const tracker = require('./tracker');

const TEST_ORDER_NUMBER = '66479331';
const TEST_ORDER_CODE = '3KTH';

(async () => {
  try {
    console.log('Testing robust tracking...');
    
    // 1st request (should trigger login)
    console.log('--- Request 1 ---');
    const result1 = await tracker.trackPackage(TEST_ORDER_NUMBER, TEST_ORDER_CODE);
    console.log('Result 1:', JSON.stringify(result1.data.apiResponse?.success, null, 2));

    // 2nd request (should reuse session)
    console.log('--- Request 2 (Reuse Session) ---');
    const start = Date.now();
    const result2 = await tracker.trackPackage(TEST_ORDER_NUMBER, TEST_ORDER_CODE);
    console.log('Result 2:', JSON.stringify(result2.data.apiResponse?.success, null, 2));
    console.log(`Request 2 took ${Date.now() - start}ms`);

    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
})();
