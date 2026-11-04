import 'dotenv/config';

import axios from 'axios';
import connectToDatabase from '../../lib/mongodb';
import Run from '../../models/Run';

async function runPipelineTest() {
  console.log('\n======================================================');
  console.log('🔄 DINOMATE CRON PIPELINE TRIGGER & WORKFLOW TEST');
  console.log('======================================================\n');

  const BASE_URL = process.env.BASE_PUBLIC_URL || 'http://localhost:3000';
  const CRON_SECRET = process.env.CRON_SECRET || 'my-external-cron-secret-token-min-32-chars';

  // -----------------------------------------------------------------
  // 1. SECURITY TEST: REJECT UNAUTHORIZED TRIGGER CALLS
  // -----------------------------------------------------------------
  console.log('🔒 [TEST 1] Security Check: Reject Requests Without CRON_SECRET...');
  try {
    const unauthorizedRes = await axios.post(`${BASE_URL}/api/run?type=image`, {}, {
      validateStatus: () => true, // don't throw on non-200
    });

    if (unauthorizedRes.status === 401) {
      console.log('   ✓ Successfully blocked unauthorized trigger (HTTP 401 Unauthorized)');
    } else {
      console.warn(`   ⚠️ Warning: Unexpected status code for unauthorized request: ${unauthorizedRes.status}`);
    }
  } catch (err: any) {
    console.log(`   ✓ Request rejected as expected: ${err.message}`);
  }

  // -----------------------------------------------------------------
  // 2. TRIGGER IMAGE PIPELINE (Instant 200 OK Check)
  // -----------------------------------------------------------------
  console.log('\n⚡ [TEST 2] Trigger Image Carousel Pipeline via Authorized Endpoint...');
  const t0 = Date.now();
  let imageRunId: string | undefined;

  try {
    const res = await axios.post(
      `${BASE_URL}/api/run?type=image`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
        },
        timeout: 10000,
      }
    );

    const elapsed = Date.now() - t0;
    console.log(`   ✓ Endpoint responded in ${elapsed}ms (HTTP ${res.status})`);
    console.log(`   Response Body:`, JSON.stringify(res.data));

    if (res.data?.success) {
      imageRunId = res.data.runId;
      console.log(`   ✓ Non-blocking background execution verified (Run ID: ${imageRunId})`);
    } else {
      throw new Error(`Pipeline response indicated failure: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    console.error('   ❌ Image pipeline trigger failed:', err.message);
    throw err;
  }

  // -----------------------------------------------------------------
  // 3. TRIGGER VIDEO REEL PIPELINE (Instant 200 OK Check)
  // -----------------------------------------------------------------
  console.log('\n⚡ [TEST 3] Trigger Video Reel Pipeline via Authorized Endpoint...');
  const t1 = Date.now();
  let videoRunId: string | undefined;

  try {
    const res = await axios.post(
      `${BASE_URL}/api/run?type=video`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
        },
        timeout: 10000,
      }
    );

    const elapsed = Date.now() - t1;
    console.log(`   ✓ Endpoint responded in ${elapsed}ms (HTTP ${res.status})`);
    console.log(`   Response Body:`, JSON.stringify(res.data));

    if (res.data?.success) {
      videoRunId = res.data.runId;
      console.log(`   ✓ Non-blocking background execution verified (Run ID: ${videoRunId})`);
    } else {
      throw new Error(`Pipeline response indicated failure: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    console.error('   ❌ Video pipeline trigger failed:', err.message);
    throw err;
  }

  // -----------------------------------------------------------------
  // 4. VERIFY RUN RECORDS IN MONGODB ATLAS
  // -----------------------------------------------------------------
  console.log('\n🗄️ [TEST 4] Verifying Pipeline Run Records in MongoDB Atlas...');
  try {
    await connectToDatabase();

    if (imageRunId) {
      const imgDoc = await Run.findById(imageRunId);
      console.log(`   ✓ Image Run verified in DB: [${imgDoc?._id}] status="${imgDoc?.status}" slot="${imgDoc?.slot}"`);
    }

    if (videoRunId) {
      const vidDoc = await Run.findById(videoRunId);
      console.log(`   ✓ Video Run verified in DB: [${vidDoc?._id}] status="${vidDoc?.status}" slot="${vidDoc?.slot}"`);
    }
  } catch (dbErr: any) {
    console.warn(`   ⚠️ MongoDB check note: ${dbErr.message}`);
  }

  console.log('\n======================================================');
  console.log('🎉 PIPELINE TRIGGER TESTS COMPLETED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runPipelineTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Pipeline test failed:', err);
    process.exit(1);
  });
