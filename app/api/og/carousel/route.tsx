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

function CoverSlide({ count, date }: { count: number; date: string }) {
  return (
    <div
      style={{
        width: '1080px',
        height: '1350px',
        backgroundColor: BG,
        backgroundImage:
          'radial-gradient(circle at 80% 15%, rgba(59,130,246,0.4) 0%, transparent 55%), radial-gradient(circle at 20% 85%, rgba(16,185,129,0.2) 0%, transparent 50%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Badge */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#1E293B',
          border: '2px solid #334155',
          padding: '12px 32px',
          borderRadius: '50px',
          color: ACCENT,
          fontSize: '26px',
          fontWeight: 800,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginBottom: '60px',
        }}
      >
        ⚡ URGENT HIRING ALERT
      </div>

      {/* Headline */}
      <div
        style={{
          fontSize: '96px',
          fontWeight: 900,
          color: WHITE,
          textAlign: 'center',
          lineHeight: 1.1,
          letterSpacing: '-2px',
          marginBottom: '30px',
        }}
      >
        {count} Fresher Jobs
      </div>
      <div
        style={{
          fontSize: '40px',
          fontWeight: 700,
          color: BLUE_LIGHT,
          textAlign: 'center',
          marginBottom: '80px',
        }}
      >
        Hiring RIGHT NOW → {date}
      </div>

      {/* Swipe hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          backgroundColor: '#1E1B4B',
          border: `2px solid ${BLUE}`,
          borderRadius: '24px',
          padding: '24px 48px',
          marginBottom: '60px',
        }}
      >
        <div style={{ fontSize: '32px', fontWeight: 800, color: WHITE }}>
          Swipe to see all jobs →
        </div>
      </div>

      {/* Branding */}
      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: BLUE,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 900,
          }}
        >
          D
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: WHITE }}>
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
}: {
  index: number;
  total: number;
  company: string;
  role: string;
  location: string;
  batch: string;
  skills: string[];
  workMode: string;
}) {
  const topSkills = skills.slice(0, 4);
  const workBadgeColor = workMode === 'REMOTE' ? GREEN : workMode === 'HYBRID' ? '#F59E0B' : BLUE;

  return (
    <div
      style={{
        width: '1080px',
        height: '1350px',
        backgroundColor: BG,
        backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(37,99,235,0.25) 0%, transparent 55%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '70px',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            fontSize: '32px',
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
            fontSize: '72px',
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
          borderRadius: '32px',
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        {/* Location + Batch */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '20px', color: SLATE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              📍 Location
            </span>
            <span style={{ fontSize: '32px', color: WHITE, fontWeight: 800 }}>
              {location}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '20px', color: SLATE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              🎓 Batch
            </span>
            <span style={{ fontSize: '32px', color: WHITE, fontWeight: 800 }}>
              {batch}
            </span>
          </div>
        </div>

        {/* Skills */}
        {topSkills.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: `2px solid ${BORDER}`, paddingTop: '28px' }}>
            <span style={{ fontSize: '20px', color: SLATE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              🛠️ Skills Required
            </span>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {topSkills.map((skill, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: BLUE + '22',
                    border: `1.5px solid ${BLUE}55`,
                    borderRadius: '50px',
                    padding: '8px 20px',
                    color: BLUE_LIGHT,
                    fontSize: '22px',
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
          borderRadius: '24px',
          padding: '28px 40px',
        }}
      >
        <div style={{ fontSize: '28px', fontWeight: 800, color: WHITE }}>
          💬 Comment <span style={{ color: ACCENT }}>"JOBS"</span> for apply link
        </div>
        <div
          style={{
            backgroundColor: BLUE,
            color: WHITE,
            padding: '14px 28px',
            borderRadius: '16px',
            fontSize: '22px',
            fontWeight: 800,
          }}
        >
          Apply Now →
        </div>
      </div>
    </div>
  );
}

function CtaSlide() {
  return (
    <div
      style={{
        width: '1080px',
        height: '1350px',
        backgroundColor: BG,
        backgroundImage:
          'radial-gradient(circle at 50% 40%, rgba(59,130,246,0.5) 0%, transparent 60%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px',
        fontFamily: 'sans-serif',
        gap: '48px',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: '120px',
          height: '120px',
          backgroundColor: BLUE,
          borderRadius: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '64px',
          fontWeight: 900,
          color: WHITE,
          boxShadow: '0 0 60px rgba(59,130,246,0.6)',
        }}
      >
        D
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '72px', fontWeight: 900, color: WHITE, letterSpacing: '-1px', textAlign: 'center' }}>
          DinoMate Jobs
        </div>
        <div style={{ fontSize: '32px', color: BLUE_LIGHT, textAlign: 'center', fontWeight: 600 }}>
          Daily verified fresher openings
        </div>
      </div>

      <div
        style={{
          backgroundColor: CARD_BG,
          border: `2px solid ${BORDER}`,
          borderRadius: '32px',
          padding: '48px 64px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '28px',
          width: '100%',
        }}
      >
        <div style={{ fontSize: '32px', fontWeight: 800, color: WHITE, textAlign: 'center' }}>
          🔔 Never Miss a Job Alert
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          {[
            '✅ Follow for daily job drops',
            '💬 Comment "JOBS" for instant apply links',
            '📲 Share with a fresher friend',
          ].map((line, i) => (
            <div key={i} style={{ fontSize: '26px', color: WHITE, fontWeight: 600, opacity: 0.9 }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          backgroundColor: GREEN + '22',
          border: `2px solid ${GREEN}`,
          borderRadius: '24px',
          padding: '20px 48px',
          fontSize: '28px',
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

  let slideEl: JSX.Element;

  if (slideType === 'cover') {
    slideEl = <CoverSlide count={count} date={dateStr} />;
  } else if (slideType === 'cta') {
    slideEl = <CtaSlide />;
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
      />
    );
  }

  return new ImageResponse(slideEl, {
    width: 1080,
    height: 1350,
  });
}

