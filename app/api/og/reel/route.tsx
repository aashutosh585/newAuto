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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const scene = searchParams.get('scene') || 'hook'; // hook | eligibility | skills | salary | cta
  const role = searchParams.get('role') || 'Software Engineer';
  const batch = searchParams.get('batch') || '2024 - 2026 Graduates';
  const degrees = searchParams.get('degrees') || 'B.Tech / BE / BCA / MCA / BSc';
  const skillsRaw = searchParams.get('skills') || 'JavaScript, Python, React, SQL, Git';
  const skills = skillsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const salary = searchParams.get('salary') || '₹4.5 - ₹12 LPA';
  const companies = searchParams.get('companies') || 'Tech Startups & Product Firms';

  let content: JSX.Element;

  if (scene === 'hook') {
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
              color: ACCENT,
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '3px',
              textTransform: 'uppercase',
            }}
          >
            ⚡ CAREER DECODED • DINOMATE
          </div>
        </div>

        {/* Center Main Hook */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '30px' }}>
          <div style={{ fontSize: '36px', fontWeight: 800, color: SLATE, textTransform: 'uppercase', letterSpacing: '4px' }}>
            FRESHER GUIDE 2025 - 2026
          </div>
          <div
            style={{
              fontSize: '84px',
              fontWeight: 900,
              color: WHITE,
              lineHeight: 1.15,
              letterSpacing: '-2px',
            }}
          >
            What Does A <span style={{ color: BLUE_LIGHT }}>{role}</span> Actually Do?
          </div>
          <div
            style={{
              fontSize: '38px',
              fontWeight: 700,
              color: ACCENT,
              marginTop: '20px',
              maxWidth: '850px',
            }}
          >
            And who is eligible to apply right now? 👇
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
              <span style={{ fontSize: '30px', fontWeight: 900, color: WHITE }}>DinoMate Jobs</span>
              <span style={{ fontSize: '22px', color: SLATE }}>Daily Fresher Insights</span>
            </div>
          </div>
          <div
            style={{
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
          <div style={{ fontSize: '32px', fontWeight: 800, color: SLATE, textTransform: 'uppercase' }}>
            Applying for {role}
          </div>
          <div style={{ fontSize: '72px', fontWeight: 900, color: WHITE, letterSpacing: '-1.5px' }}>
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
              <span style={{ fontSize: '24px', color: SLATE, fontWeight: 700 }}>ELIGIBLE BATCHES</span>
              <span style={{ fontSize: '42px', color: WHITE, fontWeight: 900 }}>{batch}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `2px solid ${BORDER}`, paddingTop: '28px' }}>
              <span style={{ fontSize: '24px', color: SLATE, fontWeight: 700 }}>ACCEPTED DEGREES</span>
              <span style={{ fontSize: '38px', color: ACCENT, fontWeight: 800 }}>{degrees}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `2px solid ${BORDER}`, paddingTop: '28px' }}>
              <span style={{ fontSize: '24px', color: SLATE, fontWeight: 700 }}>EXPERIENCE LEVEL</span>
              <span style={{ fontSize: '38px', color: GREEN, fontWeight: 800 }}>0 - 1 Years (Entry Level Freshers)</span>
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
          <div style={{ fontSize: '32px', fontWeight: 800, color: SLATE, textTransform: 'uppercase' }}>
            What Companies Test
          </div>
          <div style={{ fontSize: '72px', fontWeight: 900, color: WHITE, letterSpacing: '-1.5px' }}>
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
            <span style={{ fontSize: '24px', color: SLATE, fontWeight: 700, textTransform: 'uppercase' }}>
              CORE TECH STACK
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {skills.map((s, idx) => (
                <div
                  key={idx}
                  style={{
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

            <div style={{ borderTop: `2px solid ${BORDER}`, paddingTop: '28px', marginTop: '12px' }}>
              <span style={{ fontSize: '24px', color: SLATE, fontWeight: 700, textTransform: 'uppercase' }}>
                INTERVIEW ROUNDS
              </span>
              <div style={{ fontSize: '32px', color: WHITE, fontWeight: 700, marginTop: '12px', lineHeight: 1.4 }}>
                1. Online Assessment (DSA & Aptitude)
                <br />
                2. Technical Interview (Projects & Live Coding)
                <br />
                3. Managerial / HR Discussion
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
          <div style={{ fontSize: '32px', fontWeight: 800, color: SLATE, textTransform: 'uppercase' }}>
            Market Standards
          </div>
          <div style={{ fontSize: '72px', fontWeight: 900, color: WHITE, letterSpacing: '-1.5px' }}>
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
              <span style={{ fontSize: '24px', color: SLATE, fontWeight: 700 }}>TYPICAL FRESHER CTC</span>
              <span style={{ fontSize: '56px', color: GREEN, fontWeight: 900 }}>{salary}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `2px solid ${BORDER}`, paddingTop: '28px' }}>
              <span style={{ fontSize: '24px', color: SLATE, fontWeight: 700 }}>CURRENTLY HIRING IN INDIA</span>
              <span style={{ fontSize: '38px', color: WHITE, fontWeight: 800 }}>{companies}</span>
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
          How to get direct apply links 👇
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '80px', fontWeight: 900, color: WHITE, letterSpacing: '-2px' }}>
            Want Direct Links?
          </div>
          <div style={{ fontSize: '36px', color: BLUE_LIGHT, fontWeight: 700 }}>
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
            gap: '24px',
            width: '100%',
          }}
        >
          <div style={{ fontSize: '36px', fontWeight: 900, color: ACCENT }}>
            💬 Comment "APPLY" Below
          </div>
          <div style={{ fontSize: '28px', color: WHITE, opacity: 0.9 }}>
            We'll DM you all verified openings & roadmap instantly!
          </div>
          <div style={{ fontSize: '26px', color: SLATE, borderTop: `2px solid ${BORDER}`, paddingTop: '20px' }}>
            🔔 Follow @dinomate for daily verified tech job drops
          </div>
        </div>

        <div
          style={{
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

