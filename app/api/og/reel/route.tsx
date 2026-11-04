import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// 9:16 Vertical Video Dimensions
const WIDTH = 1080;
const HEIGHT = 1920;

const BG = '#090D16';
const CARD_BG = '#0F172A';
const BORDER = '#1E293B';
const BLUE = '#3B82F6';
const BLUE_LIGHT = '#93C5FD';
const GREEN = '#10B981';
const SLATE = '#94A3B8';
const WHITE = '#FFFFFF';
const ACCENT = '#38BDF8';
const AMBER = '#F59E0B';

function DinoMascotVector({ size = 120, pose = 'roasting' }: { size?: number; pose?: 'roasting' | 'explaining' | 'flexing' }) {
  const isFlexing = pose === 'flexing';
  const isExplaining = pose === 'explaining';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={{ display: 'flex' }}>
      <circle cx="60" cy="60" r="56" stroke={isFlexing ? '#F59E0B' : '#22C55E'} strokeWidth="3" opacity="0.4" />
      <ellipse cx="60" cy="65" rx="36" ry="34" fill="#22C55E" />
      <ellipse cx="60" cy="72" rx="22" ry="20" fill="#86EFAC" />
      <polygon points="38,36 44,25 50,36" fill="#15803D" />
      <polygon points="52,32 58,20 64,32" fill="#15803D" />
      <polygon points="66,35 72,24 78,35" fill="#15803D" />
      <circle cx="48" cy="52" r="9" fill="#FFFFFF" />
      <circle cx="49" cy="52" r="5" fill="#0F172A" />
      <circle cx="51" cy="50" r="2" fill="#FFFFFF" />
      <circle cx="72" cy="52" r="9" fill="#FFFFFF" />
      <circle cx="73" cy="52" r="5" fill="#0F172A" />
      <circle cx="75" cy="50" r="2" fill="#FFFFFF" />
      {isFlexing ? (
        <path d="M 44 66 Q 60 86 76 66" stroke="#14532D" strokeWidth="3.5" fill="#FFFFFF" />
      ) : (
        <path d="M 44 68 Q 60 84 76 68" stroke="#14532D" strokeWidth="3" fill="none" />
      )}
      <polygon points="52,69 56,76 60,69" fill="#FFFFFF" />
      <polygon points="60,69 64,76 68,69" fill="#FFFFFF" />
      <circle cx="38" cy="64" r="5" fill="#F472B6" opacity="0.6" />
      <circle cx="82" cy="64" r="5" fill="#F472B6" opacity="0.6" />
      {isFlexing ? (
        <g>
          <path d="M 38 72 Q 24 60 32 54" stroke="#15803D" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M 82 72 Q 96 60 88 54" stroke="#15803D" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </g>
      ) : isExplaining ? (
        <g>
          <path d="M 40 76 Q 30 70 38 64" stroke="#15803D" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M 80 76 Q 96 74 94 62" stroke="#15803D" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      ) : (
        <g>
          <path d="M 40 76 Q 30 82 42 86" stroke="#15803D" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M 80 76 Q 90 82 78 86" stroke="#15803D" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      )}
    </svg>
  );
}

function SoloMentorAvatarVector({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={{ display: 'flex' }}>
      <circle cx="60" cy="60" r="56" stroke="#38BDF8" strokeWidth="3" strokeDasharray="6 6" />
      <circle cx="60" cy="60" r="50" fill="#0F172A" />
      <circle cx="60" cy="46" r="22" fill="#F87171" opacity="0.85" />
      <rect x="44" y="42" width="14" height="9" rx="3" fill="#38BDF8" opacity="0.9" />
      <rect x="62" y="42" width="14" height="9" rx="3" fill="#38BDF8" opacity="0.9" />
      <line x1="58" y1="46" x2="62" y2="46" stroke="#38BDF8" strokeWidth="2" />
      <path d="M 52 56 Q 60 62 68 56" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 36 46 A 24 24 0 0 1 84 46" stroke="#94A3B8" strokeWidth="3" fill="none" />
      <circle cx="36" cy="46" r="5" fill="#38BDF8" />
      <circle cx="84" cy="46" r="5" fill="#38BDF8" />
      <path d="M 84 46 Q 80 58 72 58" stroke="#38BDF8" strokeWidth="2" fill="none" />
      <circle cx="71" cy="58" r="3" fill="#F59E0B" />
      <path d="M 30 96 C 30 76, 44 72, 60 72 C 76 72, 90 76, 90 96" fill="#1E293B" />
      <path d="M 48 76 L 60 90 L 72 76" stroke="#38BDF8" strokeWidth="2" fill="none" />
      <circle cx="88" cy="88" r="14" fill="#3B82F6" />
      <path d="M 83 88 L 87 92 L 94 84" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const scene = searchParams.get('scene') || 'hook'; // hook | eligibility | skills | salary | cta
  const archetype = searchParams.get('archetype') || 'funny_roast'; // funny_roast | breaking_drop | salary_reality | zero_exp_roadmap
  const role = searchParams.get('role') || 'Software Engineer';
  const batch = searchParams.get('batch') || '2024 - 2026 Graduates';
  const degrees = searchParams.get('degrees') || 'B.Tech / BE / BCA / MCA / BSc';
  const skillsRaw = searchParams.get('skills') || 'JavaScript, Python, React, SQL, Git';
  const skills = skillsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const salaryRaw = searchParams.get('salary') || 'Rs. 5.5 - 14 LPA';
  const salary = salaryRaw.replace(/₹/g, 'Rs. ');
  const companies = searchParams.get('companies') || 'Tech Startups & Product Firms';
  const hookTitle = searchParams.get('hookTitle') || '';
  const hookSubtitle = searchParams.get('hookSubtitle') || '';
  const roastDialogue = searchParams.get('roastDialogue') || '';

  let content: JSX.Element;

  if (scene === 'hook') {
    let archetypeBadge = '⚡ CAREER DECODED • DINOMATE';
    let archetypeSubBadge = 'FRESHER GUIDE 2025 - 2026';
    let badgeColor = ACCENT;

    if (archetype === 'dino_mascot') {
      archetypeBadge = '🦖 DINOMATE MASCOT • DINO ROASTS JOBS';
      archetypeSubBadge = 'CARTOON COMEDY & 0-EXP JOB DROP';
      badgeColor = '#22C55E';
    } else if (archetype === 'solo_explainer') {
      archetypeBadge = '🎙️ 1-ON-1 CAREER BREAKDOWN • SOLO MENTOR';
      archetypeSubBadge = 'OFF-CAMPUS ROADMAP 2025';
      badgeColor = '#38BDF8';
    } else if (archetype === 'funny_roast') {
      archetypeBadge = '🤣 POV: YOU & YOUR UNEMPLOYED FRIEND';
      archetypeSubBadge = 'CAMPUS REALITY CHECK 2025';
      badgeColor = AMBER;
    } else if (archetype === 'breaking_drop') {
      archetypeBadge = '🚨 URGENT FRESHER HIRING ALERT';
      archetypeSubBadge = 'TOP TECH FIRMS HIRING TODAY';
      badgeColor = '#EF4444';
    } else if (archetype === 'salary_reality') {
      archetypeBadge = '💰 SALARY & CTC REALITY CHECK';
      archetypeSubBadge = 'WHAT FRESHERS ACTUALLY EARN';
      badgeColor = GREEN;
    } else if (archetype === 'zero_exp_roadmap') {
      archetypeBadge = '🗺️ 0-EXP FRESHEST ROADMAP';
      archetypeSubBadge = 'NO TIER-1 / CS DEGREE NEEDED';
      badgeColor = '#A855F7';
    }

    content = (
      <div
        style={{
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          backgroundColor: BG,
          backgroundImage:
            'radial-gradient(circle at 50% 20%, rgba(59,130,246,0.45) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(16,185,129,0.2) 0%, transparent 50%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '100px 80px',
          fontFamily: 'sans-serif',
          color: WHITE,
        }}
      >
        {/* Top Tag */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#1E293B',
              border: `2px solid ${BORDER}`,
              padding: '16px 40px',
              borderRadius: '50px',
              color: badgeColor,
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            <span>{archetypeBadge}</span>
          </div>
        </div>

        {/* Center Main Hook */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', fontSize: '32px', fontWeight: 800, color: SLATE, textTransform: 'uppercase', letterSpacing: '4px' }}>
            {archetypeSubBadge}
          </div>

          {archetype === 'dino_mascot' ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                backgroundColor: CARD_BG,
                border: '3px solid #22C55E',
                borderRadius: '32px',
                padding: '40px 48px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
                <DinoMascotVector size={130} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '24px', color: '#22C55E', fontWeight: 800 }}>DINO (DINOMATE MASCOT):</span>
                  <span style={{ fontSize: '32px', color: WHITE, fontWeight: 700, marginTop: '4px' }}>
                    &quot;HR wants 5 years exp? I was extinct 65 million years ago, even I don&apos;t have that!&quot;
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '2px solid #1E293B', paddingTop: '20px' }}>
                <span style={{ fontSize: '36px' }}>🎯</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '22px', color: '#38BDF8', fontWeight: 800 }}>DINO VERIFIED DROP:</span>
                  <span style={{ fontSize: '32px', color: '#38BDF8', fontWeight: 700, marginTop: '4px' }}>
                    &quot;DinoMate just dropped real {role} with 0 exp required!&quot;
                  </span>
                </div>
              </div>
            </div>
          ) : archetype === 'solo_explainer' ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                backgroundColor: CARD_BG,
                border: '2px solid #38BDF8',
                borderRadius: '32px',
                padding: '44px 50px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
                <SoloMentorAvatarVector size={110} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '22px', color: '#38BDF8', fontWeight: 800 }}>INSIDER MENTOR BRIEFING</span>
                  <span style={{ fontSize: '38px', color: WHITE, fontWeight: 900 }}>{role}</span>
                </div>
              </div>
              <div style={{ display: 'flex', fontSize: '30px', color: '#94A3B8', fontWeight: 600 }}>
                Stop mass applying on dead job portals. Here is how to qualify directly with 0 experience.
              </div>
            </div>
          ) : archetype === 'funny_roast' && roastDialogue ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                backgroundColor: CARD_BG,
                border: '2px solid #334155',
                borderRadius: '32px',
                padding: '40px 48px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <span style={{ fontSize: '30px' }}>🗣️</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '22px', color: '#F87171', fontWeight: 800 }}>FRIEND:</span>
                  <span style={{ fontSize: '32px', color: WHITE, fontWeight: 700, marginTop: '4px' }}>
                    &quot;Bhai engineering toh ho gayi, ab chai ki tapri kholega kya?&quot;
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', borderTop: '2px solid #1E293B', paddingTop: '20px' }}>
                <span style={{ fontSize: '30px' }}>😎</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '22px', color: '#38BDF8', fontWeight: 800 }}>ME:</span>
                  <span style={{ fontSize: '32px', color: '#38BDF8', fontWeight: 700, marginTop: '4px' }}>
                    &quot;Ruk bhai! DinoMate pe verified {role} drop hua hai bina 3 saal experience ke!&quot;
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                fontSize: '80px',
                fontWeight: 900,
                color: WHITE,
                lineHeight: 1.15,
                letterSpacing: '-2px',
              }}
            >
              <div style={{ display: 'flex' }}>{hookTitle || 'What Does A'}</div>
              <div style={{ display: 'flex', color: BLUE_LIGHT }}>{role}</div>
              <div style={{ display: 'flex' }}>{hookSubtitle || 'Actually Do?'}</div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '34px',
              fontWeight: 700,
              color: ACCENT,
              marginTop: '16px',
            }}
          >
            <span>Who is eligible to apply right now?</span>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'flex' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </div>
        </div>

        {/* Bottom Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: CARD_BG,
            border: `2px solid ${BORDER}`,
            borderRadius: '32px',
            padding: '36px 48px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                backgroundColor: BLUE,
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                fontWeight: 900,
              }}
            >
              D
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ display: 'flex', fontSize: '30px', fontWeight: 900, color: WHITE }}>DinoMate Jobs</span>
              <span style={{ display: 'flex', fontSize: '22px', color: SLATE }}>Daily Fresher Insights</span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#1E1B4B',
              border: `2px solid ${BLUE}`,
              color: WHITE,
              padding: '16px 36px',
              borderRadius: '20px',
              fontSize: '26px',
              fontWeight: 800,
            }}
          >
            Watch Now 🎬
          </div>
        </div>
      </div>
    );
  } else if (scene === 'eligibility') {
    content = (
      <div
        style={{
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          backgroundColor: BG,
          backgroundImage:
            'radial-gradient(circle at 20% 15%, rgba(16,185,129,0.3) 0%, transparent 60%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '100px 80px',
          fontFamily: 'sans-serif',
          color: WHITE,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: GREEN + '22',
              border: `2px solid ${GREEN}`,
              padding: '16px 40px',
              borderRadius: '50px',
              color: GREEN,
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            🎓 ELIGIBILITY CRITERIA
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div style={{ display: 'flex', fontSize: '32px', fontWeight: 800, color: SLATE, textTransform: 'uppercase' }}>
            {`Applying for ${role}`}
          </div>
          <div style={{ display: 'flex', fontSize: '72px', fontWeight: 900, color: WHITE, letterSpacing: '-1.5px' }}>
            Who Can Apply?
          </div>

          {/* Cards */}
          <div
            style={{
              backgroundColor: CARD_BG,
              border: `2px solid ${BORDER}`,
              borderRadius: '32px',
              padding: '48px',
              display: 'flex',
              flexDirection: 'column',
              gap: '36px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ display: 'flex', fontSize: '24px', color: SLATE, fontWeight: 700 }}>ELIGIBLE BATCHES</span>
              <span style={{ display: 'flex', fontSize: '42px', color: WHITE, fontWeight: 900 }}>{batch}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `2px solid ${BORDER}`, paddingTop: '28px' }}>
              <span style={{ display: 'flex', fontSize: '24px', color: SLATE, fontWeight: 700 }}>ACCEPTED DEGREES</span>
              <span style={{ display: 'flex', fontSize: '38px', color: ACCENT, fontWeight: 800 }}>{degrees}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `2px solid ${BORDER}`, paddingTop: '28px' }}>
              <span style={{ display: 'flex', fontSize: '24px', color: SLATE, fontWeight: 700 }}>EXPERIENCE LEVEL</span>
              <span style={{ display: 'flex', fontSize: '38px', color: GREEN, fontWeight: 800 }}>0 - 1 Years (Entry Level Freshers)</span>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#1E1B4B',
            border: `2px solid ${BLUE}`,
            borderRadius: '24px',
            padding: '30px 48px',
            display: 'flex',
            justifyContent: 'center',
            fontSize: '30px',
            fontWeight: 800,
            color: WHITE,
          }}
        >
          Swipe next to see required skills ➡️
        </div>
      </div>
    );
  } else if (scene === 'skills') {
    content = (
      <div
        style={{
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          backgroundColor: BG,
          backgroundImage:
            'radial-gradient(circle at 80% 20%, rgba(59,130,246,0.4) 0%, transparent 60%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '100px 80px',
          fontFamily: 'sans-serif',
          color: WHITE,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#1E293B',
              border: `2px solid ${BORDER}`,
              padding: '16px 40px',
              borderRadius: '50px',
              color: ACCENT,
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            🛠️ SKILLS BREAKDOWN
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{ display: 'flex', fontSize: '32px', fontWeight: 800, color: SLATE, textTransform: 'uppercase' }}>
            What Companies Test
          </div>
          <div style={{ display: 'flex', fontSize: '72px', fontWeight: 900, color: WHITE, letterSpacing: '-1.5px' }}>
            Top Skills Required
          </div>

          <div
            style={{
              backgroundColor: CARD_BG,
              border: `2px solid ${BORDER}`,
              borderRadius: '32px',
              padding: '48px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <span style={{ display: 'flex', fontSize: '24px', color: SLATE, fontWeight: 700, textTransform: 'uppercase' }}>
              CORE TECH STACK
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {skills.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    backgroundColor: BLUE + '25',
                    border: `2px solid ${BLUE}`,
                    borderRadius: '50px',
                    padding: '16px 36px',
                    fontSize: '32px',
                    fontWeight: 800,
                    color: WHITE,
                  }}
                >
                  {s}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${BORDER}`, paddingTop: '28px', marginTop: '12px' }}>
              <span style={{ display: 'flex', fontSize: '24px', color: SLATE, fontWeight: 700, textTransform: 'uppercase' }}>
                INTERVIEW ROUNDS
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '32px', color: WHITE, fontWeight: 700, marginTop: '12px' }}>
                <span style={{ display: 'flex' }}>1. Online Assessment (DSA & Aptitude)</span>
                <span style={{ display: 'flex' }}>2. Technical Interview (Projects & Live Coding)</span>
                <span style={{ display: 'flex' }}>3. Managerial & HR Discussion</span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#1E1B4B',
            border: `2px solid ${BLUE}`,
            borderRadius: '24px',
            padding: '30px 48px',
            display: 'flex',
            justifyContent: 'center',
            fontSize: '30px',
            fontWeight: 800,
            color: WHITE,
          }}
        >
          Next: Expected Fresher Salary 💰
        </div>
      </div>
    );
  } else if (scene === 'salary') {
    content = (
      <div
        style={{
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          backgroundColor: BG,
          backgroundImage:
            'radial-gradient(circle at 50% 25%, rgba(245,158,11,0.25) 0%, transparent 60%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '100px 80px',
          fontFamily: 'sans-serif',
          color: WHITE,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: AMBER + '22',
              border: `2px solid ${AMBER}`,
              padding: '16px 40px',
              borderRadius: '50px',
              color: AMBER,
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            💰 COMPENSATION & HIRING
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div style={{ display: 'flex', fontSize: '32px', fontWeight: 800, color: SLATE, textTransform: 'uppercase' }}>
            Market Standards
          </div>
          <div style={{ display: 'flex', fontSize: '72px', fontWeight: 900, color: WHITE, letterSpacing: '-1.5px' }}>
            Expected Salary
          </div>

          <div
            style={{
              backgroundColor: CARD_BG,
              border: `2px solid ${BORDER}`,
              borderRadius: '32px',
              padding: '50px',
              display: 'flex',
              flexDirection: 'column',
              gap: '36px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ display: 'flex', fontSize: '24px', color: SLATE, fontWeight: 700 }}>TYPICAL FRESHER CTC</span>
              <span style={{ display: 'flex', fontSize: '56px', color: GREEN, fontWeight: 900 }}>{salary}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `2px solid ${BORDER}`, paddingTop: '28px' }}>
              <span style={{ display: 'flex', fontSize: '24px', color: SLATE, fontWeight: 700 }}>CURRENTLY HIRING IN INDIA</span>
              <span style={{ display: 'flex', fontSize: '38px', color: WHITE, fontWeight: 800 }}>{companies}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#1E1B4B',
            border: `2px solid ${BLUE}`,
            borderRadius: '24px',
            padding: '30px 48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '30px',
            fontWeight: 800,
            color: WHITE,
          }}
        >
          <span>How to get direct apply links</span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'flex' }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </div>
      </div>
    );
  } else {
    // scene === 'cta'
    content = (
      <div
        style={{
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          backgroundColor: BG,
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.5) 0%, transparent 65%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '100px 80px',
          fontFamily: 'sans-serif',
          color: WHITE,
          gap: '60px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '140px',
            height: '140px',
            backgroundColor: BLUE,
            borderRadius: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '76px',
            fontWeight: 900,
            color: WHITE,
            boxShadow: '0 0 80px rgba(59,130,246,0.7)',
          }}
        >
          D
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', fontSize: '80px', fontWeight: 900, color: WHITE, letterSpacing: '-2px' }}>
            Want Direct Links?
          </div>
          <div style={{ display: 'flex', fontSize: '36px', color: BLUE_LIGHT, fontWeight: 700 }}>
            Active hiring openings are verified & live
          </div>
        </div>

        <div
          style={{
            backgroundColor: CARD_BG,
            border: `2px solid ${BORDER}`,
            borderRadius: '32px',
            padding: '48px 60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', fontSize: '36px', fontWeight: 900, color: ACCENT }}>
            💬 Comment "APPLY" Below
          </div>
          <div style={{ display: 'flex', fontSize: '28px', color: WHITE, opacity: 0.9 }}>
            We'll DM you all verified openings & roadmap instantly!
          </div>
          <div style={{ display: 'flex', fontSize: '26px', color: SLATE, borderTop: `2px solid ${BORDER}`, paddingTop: '20px' }}>
            🔔 Follow @dinomate for daily verified tech job drops
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            backgroundColor: GREEN,
            color: WHITE,
            borderRadius: '24px',
            padding: '24px 60px',
            fontSize: '32px',
            fontWeight: 900,
          }}
        >
          🚀 dinomate.app — Start Today
        </div>
      </div>
    );
  }

  return new ImageResponse(content, {
    width: WIDTH,
    height: HEIGHT,
  });
}
