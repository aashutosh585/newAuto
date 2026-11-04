import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Slide types
type SlideData =
  | { type: 'cover'; count: number; date: string }
  | { type: 'job'; index: number; total: number; company: string; role: string; location: string; batch: string; skills: string[]; workMode: string }
  | { type: 'cta' };

const BG = '#090D16';
const CARD_BG = '#0F172A';
const BORDER = '#1E293B';
const BLUE = '#3B82F6';
const BLUE_LIGHT = '#93C5FD';
const GREEN = '#10B981';
const SLATE = '#64748B';
const WHITE = '#F8FAFC';
const ACCENT = '#38BDF8';

function CoverSlide({ count, date, isSquare = false }: { count: number; date: string; isSquare?: boolean }) {
  return (
    <div
      style={{
        width: '1080px',
        height: isSquare ? '1080px' : '1350px',
        backgroundColor: BG,
        backgroundImage:
          'radial-gradient(circle at 80% 15%, rgba(59,130,246,0.4) 0%, transparent 55%), radial-gradient(circle at 20% 85%, rgba(16,185,129,0.2) 0%, transparent 50%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: isSquare ? '48px 60px' : '80px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Badge */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#1E293B',
          border: '2px solid #334155',
          padding: isSquare ? '10px 26px' : '12px 32px',
          borderRadius: '50px',
          color: ACCENT,
          fontSize: isSquare ? '22px' : '26px',
          fontWeight: 800,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginBottom: isSquare ? '36px' : '60px',
        }}
      >
        ⚡ URGENT HIRING ALERT
      </div>

      {/* Headline */}
      <div
        style={{
          fontSize: isSquare ? '80px' : '96px',
          fontWeight: 900,
          color: WHITE,
          textAlign: 'center',
          lineHeight: 1.1,
          letterSpacing: '-2px',
          marginBottom: isSquare ? '20px' : '30px',
        }}
      >
        {count} Fresher Jobs
      </div>
      <div
        style={{
          fontSize: isSquare ? '32px' : '40px',
          fontWeight: 700,
          color: BLUE_LIGHT,
          textAlign: 'center',
          marginBottom: isSquare ? '48px' : '80px',
        }}
      >
        Hiring RIGHT NOW • {date}
      </div>

      {/* Swipe hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#1E1B4B',
          border: `2px solid ${BLUE}`,
          borderRadius: '24px',
          padding: isSquare ? '18px 36px' : '24px 48px',
          marginBottom: isSquare ? '40px' : '60px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: isSquare ? '26px' : '32px', fontWeight: 800, color: WHITE }}>
          <span>Swipe to see all jobs</span>
          <svg
            width={isSquare ? "22" : "28"}
            height={isSquare ? "22" : "28"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: 'flex' }}
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>

      {/* Branding */}
      <div
        style={{
          position: 'absolute',
          bottom: isSquare ? '40px' : '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: isSquare ? '40px' : '48px',
            height: isSquare ? '40px' : '48px',
            backgroundColor: BLUE,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isSquare ? '24px' : '28px',
            fontWeight: 900,
          }}
        >
          D
        </div>
        <div style={{ fontSize: isSquare ? '24px' : '28px', fontWeight: 800, color: WHITE }}>
          DinoMate Jobs
        </div>
      </div>
    </div>
  );
}

function JobSlide({
  index,
  total,
  company,
  role,
  location,
  batch,
  skills,
  workMode,
  isSquare = false,
}: {
  index: number;
  total: number;
  company: string;
  role: string;
  location: string;
  batch: string;
  skills: string[];
  workMode: string;
  isSquare?: boolean;
}) {
  const topSkills = skills.slice(0, 4);
  const workBadgeColor = workMode === 'REMOTE' ? GREEN : workMode === 'HYBRID' ? '#F59E0B' : BLUE;

  return (
    <div
      style={{
        width: '1080px',
        height: isSquare ? '1080px' : '1350px',
        backgroundColor: BG,
        backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(37,99,235,0.25) 0%, transparent 55%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: isSquare ? '44px 56px' : '70px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Top: counter + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          style={{
            backgroundColor: '#1E293B',
            border: `2px solid ${BORDER}`,
            borderRadius: '50px',
            padding: '10px 28px',
            color: SLATE,
            fontSize: '22px',
            fontWeight: 700,
          }}
        >
          Job {index} of {total}
        </div>
        <div
          style={{
            backgroundColor: workBadgeColor + '22',
            border: `2px solid ${workBadgeColor}`,
            borderRadius: '50px',
            padding: '10px 24px',
            color: workBadgeColor,
            fontSize: '22px',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          {workMode || 'ONSITE'}
        </div>
      </div>

      {/* Company + Role */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isSquare ? '8px' : '12px' }}>
        <div
          style={{
            fontSize: isSquare ? '26px' : '32px',
            fontWeight: 800,
            color: SLATE,
            textTransform: 'uppercase',
            letterSpacing: '3px',
          }}
        >
          {company}
        </div>
        <div
          style={{
            fontSize: isSquare ? '56px' : '72px',
            fontWeight: 900,
            color: WHITE,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
          }}
        >
          {role}
        </div>
      </div>

      {/* Details card */}
      <div
        style={{
          backgroundColor: CARD_BG,
          border: `2px solid ${BORDER}`,
          borderRadius: isSquare ? '24px' : '32px',
          padding: isSquare ? '28px 38px' : '48px',
          display: 'flex',
          flexDirection: 'column',
          gap: isSquare ? '18px' : '32px',
        }}
      >
        {/* Location + Batch */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: isSquare ? '17px' : '20px', color: SLATE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              📍 Location
            </span>
            <span style={{ fontSize: isSquare ? '26px' : '32px', color: WHITE, fontWeight: 800 }}>
              {location}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: isSquare ? '17px' : '20px', color: SLATE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              🎓 Batch
            </span>
            <span style={{ fontSize: isSquare ? '26px' : '32px', color: WHITE, fontWeight: 800 }}>
              {batch}
            </span>
          </div>
        </div>

        {/* Skills */}
        {topSkills.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isSquare ? '10px' : '14px', borderTop: `2px solid ${BORDER}`, paddingTop: isSquare ? '18px' : '28px' }}>
            <span style={{ fontSize: isSquare ? '17px' : '20px', color: SLATE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              🛠️ Skills Required
            </span>
            <div style={{ display: 'flex', gap: isSquare ? '8px' : '12px', flexWrap: 'wrap' }}>
              {topSkills.map((skill, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: BLUE + '22',
                    border: `1.5px solid ${BLUE}55`,
                    borderRadius: '50px',
                    padding: isSquare ? '6px 16px' : '8px 20px',
                    color: BLUE_LIGHT,
                    fontSize: isSquare ? '18px' : '22px',
                    fontWeight: 700,
                  }}
                >
                  {skill}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#1E1B4B',
          border: `2px solid ${BLUE}`,
          borderRadius: isSquare ? '20px' : '24px',
          padding: isSquare ? '18px 30px' : '28px 40px',
        }}
      >
        <div style={{ fontSize: isSquare ? '22px' : '28px', fontWeight: 800, color: WHITE }}>
          💬 Comment <span style={{ color: ACCENT }}>"JOBS"</span> for apply link
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: BLUE,
            color: WHITE,
            padding: isSquare ? '10px 22px' : '14px 28px',
            borderRadius: '16px',
            fontSize: isSquare ? '19px' : '22px',
            fontWeight: 800,
          }}
        >
          <span>Apply Now</span>
          <svg
            width={isSquare ? "18" : "22"}
            height={isSquare ? "18" : "22"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: 'flex' }}
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function CtaSlide({ isSquare = false }: { isSquare?: boolean }) {
  return (
    <div
      style={{
        width: '1080px',
        height: isSquare ? '1080px' : '1350px',
        backgroundColor: BG,
        backgroundImage:
          'radial-gradient(circle at 50% 40%, rgba(59,130,246,0.5) 0%, transparent 60%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: isSquare ? '48px 60px' : '80px',
        fontFamily: 'sans-serif',
        gap: isSquare ? '28px' : '48px',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: isSquare ? '90px' : '120px',
          height: isSquare ? '90px' : '120px',
          backgroundColor: BLUE,
          borderRadius: isSquare ? '24px' : '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isSquare ? '48px' : '64px',
          fontWeight: 900,
          color: WHITE,
          boxShadow: '0 0 60px rgba(59,130,246,0.6)',
        }}
      >
        D
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isSquare ? '10px' : '16px' }}>
        <div style={{ fontSize: isSquare ? '56px' : '72px', fontWeight: 900, color: WHITE, letterSpacing: '-1px', textAlign: 'center' }}>
          DinoMate Jobs
        </div>
        <div style={{ fontSize: isSquare ? '26px' : '32px', color: BLUE_LIGHT, textAlign: 'center', fontWeight: 600 }}>
          Daily verified fresher openings
        </div>
      </div>

      <div
        style={{
          backgroundColor: CARD_BG,
          border: `2px solid ${BORDER}`,
          borderRadius: isSquare ? '24px' : '32px',
          padding: isSquare ? '36px 48px' : '48px 64px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isSquare ? '20px' : '28px',
          width: '100%',
        }}
      >
        <div style={{ fontSize: isSquare ? '26px' : '32px', fontWeight: 800, color: WHITE, textAlign: 'center' }}>
          🔔 Never Miss a Job Alert
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isSquare ? '12px' : '16px', width: '100%' }}>
          {[
            '✅ Follow for daily job drops',
            '💬 Comment "JOBS" for instant apply links',
            '📲 Share with a fresher friend',
          ].map((line, i) => (
            <div key={i} style={{ fontSize: isSquare ? '22px' : '26px', color: WHITE, fontWeight: 600, opacity: 0.9 }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          backgroundColor: GREEN + '22',
          border: `2px solid ${GREEN}`,
          borderRadius: isSquare ? '20px' : '24px',
          padding: isSquare ? '16px 36px' : '20px 48px',
          fontSize: isSquare ? '24px' : '28px',
          fontWeight: 800,
          color: GREEN,
        }}
      >
        🚀 dinomate.app — Your Career Starts Here
      </div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const slideType = searchParams.get('slide') || 'job'; // cover | job | cta
  const index = parseInt(searchParams.get('index') || '1', 10);
  const total = parseInt(searchParams.get('total') || '5', 10);
  const company = searchParams.get('company') || 'TECH COMPANY';
  const role = searchParams.get('role') || 'Software Engineer';
  const location = searchParams.get('location') || 'Remote / India';
  const batch = searchParams.get('batch') || '2024 / 2025';
  const skillsRaw = searchParams.get('skills') || '';
  const skills = skillsRaw ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const workMode = searchParams.get('workMode') || 'REMOTE';
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const count = parseInt(searchParams.get('count') || '5', 10);

  const aspect = searchParams.get('aspect') || searchParams.get('ratio') || '1:1';
  const isSquare = aspect === '1:1' || aspect === '4:4' || aspect === '4*4' || aspect === 'square';
  const width = 1080;
  const height = isSquare ? 1080 : 1350;

  let slideEl: JSX.Element;

  if (slideType === 'cover') {
    slideEl = <CoverSlide count={count} date={dateStr} isSquare={isSquare} />;
  } else if (slideType === 'cta') {
    slideEl = <CtaSlide isSquare={isSquare} />;
  } else {
    slideEl = (
      <JobSlide
        index={index}
        total={total}
        company={company}
        role={role}
        location={location}
        batch={batch}
        skills={skills}
        workMode={workMode}
        isSquare={isSquare}
      />
    );
  }

  return new ImageResponse(slideEl, {
    width,
    height,
  });
}

