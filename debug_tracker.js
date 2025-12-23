require('dotenv').config();
const { trackPackage } = require('./tracker');

const TEST_TRACKING_CODE = '0000-000000'; // Fake code to just test login navigation

(async () => {
  try {
    console.log('Testing tracking with env credentials...');
    const result = await trackPackage(
      TEST_TRACKING_CODE, 
      process.env.SHALOM_USER, 
      process.env.SHALOM_PASS
    );
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test failed:', error);
  }
})();
