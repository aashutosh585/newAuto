import 'dotenv/config';

import axios from 'axios';
import mongoose from 'mongoose';
import connectToDatabase from '../../lib/mongodb';
import { listConnectedAccounts } from '../../lib/zernio';
import { executeLLM } from '../../lib/litellm';

async function runSystemTest() {
  console.log('\n======================================================');
  console.log('🛠️ DINOMATE SYSTEM & INTEGRATION HEALTH CHECK');
  console.log('======================================================\n');

  // -----------------------------------------------------------------
  // 1. ENVIRONMENT VARIABLES AUDIT
  // -----------------------------------------------------------------
  console.log('📋 [CHECK 1] Environment Variables Audit');
  const requiredVars = [
    { name: 'ADMIN_PASSWORD', val: process.env.ADMIN_PASSWORD, critical: true },
    { name: 'MONGODB_URI', val: process.env.MONGODB_URI, critical: true },
    { name: 'DINOMATE_API_KEY', val: process.env.DINOMATE_API_KEY, critical: false },
    { name: 'ZERNIO_API_KEY', val: process.env.ZERNIO_API_KEY, critical: false },
    { name: 'ZERNIO_PROFILE_ID', val: process.env.ZERNIO_PROFILE_ID, critical: false },
    { name: 'MOONMATH_API_KEY', val: process.env.MOONMATH_API_KEY, critical: false },
    { name: 'OPENROUTER_API_KEY', val: process.env.OPENROUTER_API_KEY, critical: false },
    { name: 'ITERACOMPUTE_API_KEY', val: process.env.ITERACOMPUTE_API_KEY, critical: false },
  ];

  for (const v of requiredVars) {
    const status = v.val ? '✓ Set' : v.critical ? '❌ MISSING (Critical)' : '⚠️ Unset (Optional)';
    const masked = v.val ? (v.val.length > 8 ? `${v.val.slice(0, 4)}...${v.val.slice(-4)}` : '****') : 'none';
    console.log(`   - ${v.name.padEnd(22)}: ${status} (${masked})`);
  }

  // -----------------------------------------------------------------
  // 2. MONGODB ATLAS CONNECTIVITY CHECK
  // -----------------------------------------------------------------
  console.log('\n🗄️ [CHECK 2] MongoDB Atlas Connectivity');
  try {
    const t0 = Date.now();
    await connectToDatabase();
    const ms = Date.now() - t0;
    const dbName = mongoose.connection.name || 'default';
    const collections = await mongoose.connection.db?.listCollections().toArray();
    console.log(`   ✓ Connected to MongoDB Atlas [${dbName}] in ${ms}ms`);
    console.log(`   Collections found: ${(collections || []).map((c) => c.name).join(', ') || 'none yet'}`);
  } catch (mErr: any) {
    console.error('   ❌ MongoDB Atlas connection failed:', mErr.message);
  }

  // -----------------------------------------------------------------
  // 3. DINOMATE PUBLIC JOBS API CHECK
  // -----------------------------------------------------------------
  console.log('\n🦖 [CHECK 3] DinoMate Jobs API Integration');
  try {
    const dinoKey = process.env.DINOMATE_API_KEY || 'publickey';
    const t0 = Date.now();
    const res = await axios.get('https://dinomate.app/api/public/jobs', {
      params: { q: 'developer', limit: 2 },
      headers: { 'x-api-key': dinoKey },
      timeout: 10000,
    });
    const ms = Date.now() - t0;
    const count = res.data?.data?.length || 0;
    console.log(`   ✓ DinoMate API online (status ${res.status}) in ${ms}ms - ${count} jobs returned`);
  } catch (dErr: any) {
    console.error('   ❌ DinoMate API check failed:', dErr.message);
  }

  // -----------------------------------------------------------------
  // 4. ZERNIO SOCIAL CHANNELS CHECK
  // -----------------------------------------------------------------
  console.log('\n📲 [CHECK 4] Zernio Social Accounts Connection');
  try {
    const accounts = await listConnectedAccounts();
    console.log(`   ✓ Zernio API reached - Connected platforms: ${accounts.length}`);
    if (accounts.length > 0) {
      accounts.forEach((a) => {
        console.log(`     • ${a.platform || a.type}: @${a.username || a.displayName || a.id} (${a.status || 'connected'})`);
      });
    } else {
      console.log('     ℹ️ No accounts linked yet. Use the dashboard to connect channels via Zernio.');
    }
  } catch (zErr: any) {
    console.warn(`   ⚠️ Zernio check note: ${zErr.message}`);
  }

  // -----------------------------------------------------------------
  // 5. AI PROVIDER LATENCY & PRIORITIZATION BENCHMARK
  // -----------------------------------------------------------------
  console.log('\n⚡ [CHECK 5] Multi-Model AI Gateway Benchmark');
  try {
    const t0 = Date.now();
    const testResult = await executeLLM({
      alias: 'fast',
      messages: [{ role: 'user', content: 'Reply with JSON: {"status": "ok"}' }],
      jsonMode: true,
    });
    const totalMs = Date.now() - t0;
    console.log(`   ✓ Primary Fast Model [${testResult.model}] responded in ${totalMs}ms`);
    console.log(`   Token Usage: ${testResult.totalTokens} tokens`);
  } catch (aiErr: any) {
    console.error('   ❌ AI Gateway execution failed:', aiErr.message);
  }

  console.log('\n======================================================');
  console.log('🎉 SYSTEM HEALTH AUDIT FINISHED');
  console.log('======================================================\n');
}

runSystemTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('System test failed:', err);
    process.exit(1);
  });
