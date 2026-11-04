import 'dotenv/config';
import { discoverTrends, calculateTrendSignals } from '../../lib/trend/trend-discovery';
import {
  selectVideoFormat,
  FORMAT_REGISTRY,
  VideoFormatId,
} from '../../lib/variety/format-engine';
import {
  evaluateIdeaSimilarity,
  recordVideoToMemory,
  getRecentMemories,
} from '../../lib/variety/content-memory';
import {
  generateStructuredBrief,
  StructuredContentBrief,
} from '../../lib/variety/script-brief-engine';
import { runVideoQualityCheck } from '../../lib/variety/quality-checks';

async function runVarietyEngineTests() {
  console.log('\n================================================================');
  console.log('🚀 AI VIDEO VARIETY ENGINE: FULL INTEGRATION & VALIDATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ===========================================================================
  // TEST 1: TREND DISCOVERY & BREAKOUT SCORING (TASK 2)
  // ===========================================================================
  console.log('📊 [TEST 1] Testing Trend Discovery & Breakout Signal Scoring...');

  // 1.1 Breakout calculation
  const fastTrendSignals = calculateTrendSignals(15000, new Date(Date.now() - 2 * 3600 * 1000), 2000);
  assert(fastTrendSignals.velocity > 5000, `High velocity calculated correctly (${fastTrendSignals.velocity} views/hr)`);
  assert(fastTrendSignals.isBreakout === true, 'Detected breakout signal for surging engagement');

  const slowTrendSignals = calculateTrendSignals(500, new Date(Date.now() - 24 * 3600 * 1000), 2000);
  assert(slowTrendSignals.isBreakout === false, 'Steady/slow trend not falsely labeled as breakout');

  // 1.2 Multi-niche trend fetching & resilience
  const fresherTrends = await discoverTrends({ niche: 'fresher_careers', limit: 3 });
  assert(fresherTrends.length > 0, `Discovered ${fresherTrends.length} fresher career trends`);
  assert(fresherTrends[0].topic.length > 5, `Top topic: "${fresherTrends[0].topic.slice(0, 50)}..."`);
  assert(fresherTrends[0].confidenceScore >= 0.8, 'Trend carries verified confidence score');
  assert(!!fresherTrends[0].sourceUrl, `Trend contains verifiable evidence source (${fresherTrends[0].sourceUrl})`);

  // ===========================================================================
  // TEST 2: VIDEO FORMAT ENGINE (TASK 3)
  // ===========================================================================
  console.log('\n🎭 [TEST 2] Testing Video Format Engine & 12 Formats...');

  const expectedFormats: VideoFormatId[] = [
    'mini_documentary',
    'storytelling',
    'pov',
    'myth_vs_fact',
    'top_listicle',
    'tutorial',
    'news_explainer',
    'before_vs_after',
    'problem_vs_solution',
    'experiment_challenge',
    'case_study',
    'cinematic_narrative',
  ];

  assert(
    Object.keys(FORMAT_REGISTRY).length === 12,
    `All 12 required formats registered (Found: ${Object.keys(FORMAT_REGISTRY).length})`
  );

  expectedFormats.forEach((formatId) => {
    const spec = FORMAT_REGISTRY[formatId];
    assert(!!spec.name, `Format "${formatId}" has name: "${spec.name}"`);
    assert(spec.narrativeArc.length >= 4, `Format "${formatId}" has multi-step narrative arc (${spec.narrativeArc.length} steps)`);
    assert(!!spec.storyboardBeats.scene1, `Format "${formatId}" has storyboard scene 1 beat`);
    assert(
      spec.targetDurationSec.max <= 20 && spec.targetDurationSec.min >= 15,
      `Format "${formatId}" strictly calibrated for 15-20s viral reels`
    );
  });

  // 2.2 Intelligent Format Selection by Topic Affinity
  const mythDecision = selectVideoFormat({
    topic: 'The 3-Second ATS Filter Myth: Why Everyone Gets It Wrong',
    niche: 'fresher_careers',
  });
  assert(mythDecision.format.id === 'myth_vs_fact', `Selected format for myth topic is "myth_vs_fact" (Got: ${mythDecision.format.id})`);

  const listicleDecision = selectVideoFormat({
    topic: 'Top 3 Highest Paying Tech Roles for BCA MCA Freshers',
    niche: 'fresher_careers',
  });
  assert(listicleDecision.format.id === 'top_listicle', `Selected format for list topic is "top_listicle" (Got: ${listicleDecision.format.id})`);

  const roastDecision = selectVideoFormat({
    topic: 'Engineering Degree vs Chai Tapri: The Unemployed Friend Roast',
    niche: 'humor_roasts',
    preferHumor: true,
  });
  assert(
    roastDecision.format.id === 'pov' || roastDecision.format.id === 'cinematic_narrative',
    `Selected format for comedy roast topic is POV or Cinematic Narrative (Got: ${roastDecision.format.id})`
  );

  // 2.3 Anti-Fatigue Format Penalty (Diversity across uploads)
  const fatiguedDecision = selectVideoFormat({
    topic: 'Top 5 Tech Skills for 2025',
    recentFormats: ['top_listicle', 'top_listicle'], // format fatigue
  });
  assert(
    fatiguedDecision.format.id !== 'top_listicle',
    `Anti-fatigue penalty successfully rotated away from recently repeated "top_listicle" to "${fatiguedDecision.format.id}"`
  );

  // ===========================================================================
  // TEST 3: CONTENT MEMORY & DUPLICATE PREVENTION (TASK 4)
  // ===========================================================================
  console.log('\n🧠 [TEST 3] Testing Content Memory & Similarity Deduplication...');

  // 3.1 Record past video into memory
  await recordVideoToMemory({
    topic: 'Mass Hiring Surge: Top Startups Opening Zero-Experience Roles',
    niche: 'fresher_careers',
    formatType: 'news_explainer',
    archetype: 'breaking_drop',
    uniqueAngle: 'Urgent notification on newly verified job openings',
    hookText: 'Stop scrolling if you need an entry-level software job right now.',
    hookType: 'question',
    tags: ['#freshers', '#jobs'],
  });

  const recent = await getRecentMemories(5);
  assert(recent.length > 0, `Recorded video in content memory (Recent items: ${recent.length})`);

  // 3.2 Test near-duplicate topic and hook rejection
  const nearDuplicate = await evaluateIdeaSimilarity({
    topic: 'Mass Hiring Surge: Top Startups Opening Zero-Experience Roles',
    hookText: 'Stop scrolling if you need an entry-level software job right now.',
    formatType: 'news_explainer',
  });
  assert(nearDuplicate.isDuplicate === true, 'Detected and rejected near-duplicate topic and hook');
  assert(nearDuplicate.rejectionReason!.length > 0, `Rejection reason provided: "${nearDuplicate.rejectionReason}"`);

  // 3.3 Test legitimate recurring topic with genuinely different angle & format
  const distinctAngleCandidate = await evaluateIdeaSimilarity({
    topic: 'Mass Hiring Surge: Top Startups Opening Zero-Experience Roles',
    hookText: 'My friend said startups never hire freshers until we looked at this data.',
    uniqueAngle: 'Debunking the myth that startups only take senior engineers',
    formatType: 'myth_vs_fact', // Different format
  });
  assert(
    distinctAngleCandidate.isDuplicate === false,
    'Approved legitimate recurring topic with distinct angle and contrasting format (myth_vs_fact)'
  );
  assert(distinctAngleCandidate.isDistinctAngle === true, 'Flagged as distinct angle approval');

  // ===========================================================================
  // TEST 4: STRUCTURED CONTENT BRIEF & AI SCRIPTING (TASK 5)
  // ===========================================================================
  console.log('\n📝 [TEST 4] Testing 10-Point Structured Content Brief & Script Generation...');

  const sampleTrend = fresherTrends[0];
  const brief = await generateStructuredBrief({
    trend: sampleTrend,
    format: FORMAT_REGISTRY.pov,
    preferHumor: true,
    skipLLMNetwork: true, // Fast, reliable deterministic brief testing
  });

  assert(!!brief.targetAudience, `Brief contains target audience: "${brief.targetAudience}"`);
  assert(brief.selectedFormat === 'pov', `Brief matches selected format (${brief.selectedFormat})`);
  assert(brief.storyboard.length === 5, `Storyboard contains exactly 5 scenes (Got: ${brief.storyboard.length})`);
  assert(!!brief.hookBlueprint.spokenHook, `Hook blueprint has spoken hook: "${brief.hookBlueprint.spokenHook.slice(0, 45)}..."`);
  assert(!!brief.storyboard[0].roastDialogue, `Includes comedy friend roast dialogue: "${brief.storyboard[0].roastDialogue?.slice(0, 60)}..."`);
  assert(!!brief.callToAction.keywordTrigger, `Call to action keyword: "${brief.callToAction.keywordTrigger}"`);

  // ===========================================================================
  // TEST 5: QUALITY VALIDATION & FACTUAL GUARDRAILS (TASK 7)
  // ===========================================================================
  console.log('\n🛡️ [TEST 5] Testing Quality Checks & Factual Guardrails...');

  // 5.1 Test valid brief (strictly within 15-20s range)
  const totalBriefDuration = brief.storyboard.reduce((sum, s) => sum + (s.estimatedDurationSec || 3.5), 0);
  assert(
    totalBriefDuration >= 15 && totalBriefDuration <= 20,
    `Brief duration strictly within 15-20s range (${totalBriefDuration.toFixed(1)}s)`
  );

  const validReport = runVideoQualityCheck({
    brief,
    targetDurationSec: 18,
    aspectRatio: '9:16',
  });
  assert(validReport.passed === true, `Valid brief passed quality check (Score: ${validReport.score}/100)`);

  // 5.2 Test unverified absolute claim auto-fix
  const briefWithUnverifiedClaim = JSON.parse(JSON.stringify(brief));
  briefWithUnverifiedClaim.storyboard[3].narrationText = 'Apply now for a 100% guaranteed job with zero effort required!';

  const claimReport = runVideoQualityCheck({
    brief: briefWithUnverifiedClaim,
    aspectRatio: '9:16',
  });
  assert(
    claimReport.issues.some((i) => i.type === 'factual_claim'),
    'Flagged unverified absolute claim ("100% guaranteed job")'
  );
  assert(
    claimReport.fixedBrief !== undefined,
    'Auto-fixed unverified claim into legally safe phrasing'
  );
  assert(
    !claimReport.fixedBrief?.storyboard[3].narrationText.includes('100% guaranteed job'),
    'Sanitized text removed dangerous absolute guarantee'
  );

  // 5.3 Test invalid aspect ratio
  const invalidRatioReport = runVideoQualityCheck({
    brief,
    aspectRatio: '4:3' as any,
  });
  assert(
    invalidRatioReport.issues.some((i) => i.type === 'aspect_ratio'),
    'Flagged unsupported aspect ratio (4:3)'
  );

  // ===========================================================================
  // TEST 6: VARIETY DEMONSTRATION ACROSS 4 DISTINCT VIDEO MODELS
  // ===========================================================================
  console.log('\n🎨 [TEST 6] Multi-Model Video Variety Demonstration (4 Distinct Archetypes):');
  console.log('----------------------------------------------------------------------------');

  const demoTopics = [
    {
      topic: 'Friend Roasts Engineering Degree With No Placement ("Chai Ki Tapri")',
      niche: 'humor_roasts',
      humor: true,
      humorStyle: 'friend_roast' as const,
      modelType: '1. Funny Friend Roast (POV)'
    },
    {
      topic: 'Companies Asking 5 Years Experience for Fresher Internships',
      niche: 'humor_roasts',
      humor: true,
      humorStyle: 'corporate_sarcasm' as const,
      modelType: '2. Corporate Sarcasm / Reality Check'
    },
    {
      topic: 'The ATS Resume Myth: Why Tier-1 College Is No Longer Required in 2025',
      niche: 'fresher_careers',
      humor: false,
      modelType: '3. Myth vs Fact / Career Reality Check'
    },
    {
      topic: 'The LinkedIn 500-Application Black Hole vs Verified Direct Referrals',
      niche: 'salary_reality',
      humor: false,
      modelType: '4. Problem vs Solution / Hiring Blueprint'
    },
  ];

  const demoResults = [];
  const runningFormats: VideoFormatId[] = [];

  for (const item of demoTopics) {
    const sel = selectVideoFormat({
      topic: item.topic,
      niche: item.niche,
      recentFormats: runningFormats,
      preferHumor: item.humor,
    });
    runningFormats.push(sel.format.id);

    const generatedBrief = await generateStructuredBrief({
      trend: {
        id: `demo_${Date.now()}`,
        topic: item.topic,
        summary: item.topic,
        source: 'curated_radar',
        sourceUrl: 'https://dinomate.app',
        publishedAt: new Date(),
        velocityScore: 18000,
        isBreakout: true,
        matchedKeywords: ['demo'],
        niche: item.niche,
        evidenceLevel: 'curated_baseline',
        confidenceScore: 0.92,
        suggestedAngles: [item.topic],
      },
      format: sel.format,
      preferHumor: item.humor,
      humorStyle: item.humorStyle,
      skipLLMNetwork: true,
    });

    demoResults.push({
      model: item.modelType,
      format: sel.format.name,
      formatId: sel.format.id,
      tone: sel.format.narrationTone,
      hook: generatedBrief.storyboard[0].narrationText.slice(0, 60) + '...',
      dialogue: generatedBrief.storyboard[0].roastDialogue ? generatedBrief.storyboard[0].roastDialogue.slice(0, 48) + '...' : 'None',
      cta: generatedBrief.storyboard[4].onScreenHeadline,
    });

    // Validate that funny briefs contain roast dialogue
    if (item.humor) {
      assert(
        !!generatedBrief.storyboard[0].roastDialogue,
        `Funny model "${item.modelType}" generated comedic dialogue`
      );
    }
  }

  console.table(demoResults);

  // Assert all 4 generated formats are distinct
  const uniqueFormats = new Set(demoResults.map((r) => r.formatId));
  assert(
    uniqueFormats.size === 4,
    `All 4 demo videos used completely distinct formats: [${Array.from(uniqueFormats).join(', ')}]`
  );

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('Video Variety Engine is robust, evidence-backed, and production ready.');
  console.log('================================================================\n');
}

runVarietyEngineTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
