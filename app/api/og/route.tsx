import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const title = searchParams.get('title') || 'Software Engineer Fresher';
  const company = searchParams.get('company') || 'TECH COMPANY';
  const location = searchParams.get('location') || 'Remote / India';
  const batch = searchParams.get('batch') || '2024 / 2025 / 2026';
  const salary = (searchParams.get('salary') || 'Rs. 6 - 14 LPA').replace(/₹/g, 'Rs. ');
  const skills = (searchParams.get('skills') || 'React,Node.js,TypeScript,DSA').split(',').map((s) => s.trim()).filter(Boolean);
  
  // Aspect ratio: Default to 4x4 ratio (1080x1080 square) as requested
  const aspect = searchParams.get('aspect') || searchParams.get('ratio') || '1:1';
  const isSquare = aspect === '1:1' || aspect === '4:4' || aspect === '4*4' || aspect === 'square';
  const width = 1080;
  const height = isSquare ? 1080 : 1350;

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return new ImageResponse(
    (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: '#090D16',
          backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(37, 99, 235, 0.4) 0%, transparent 60%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: isSquare ? '52px 64px' : '70px 80px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#1E293B',
              border: '2px solid #334155',
              padding: '10px 24px',
              borderRadius: '50px',
              alignSelf: 'flex-start',
              color: '#38BDF8',
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#38BDF8" style={{ display: 'flex', marginRight: '8px' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>VERIFIED HIRING • {dateStr}</span>
          </div>

          <div
            style={{
              fontSize: isSquare ? '28px' : '34px',
              fontWeight: 800,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginTop: isSquare ? '28px' : '38px',
            }}
          >
            {company}
          </div>

          <div
            style={{
              fontSize: isSquare ? '54px' : '64px',
              fontWeight: 900,
              lineHeight: 1.15,
              color: '#FFFFFF',
              marginTop: '10px',
              letterSpacing: '-1.5px',
            }}
          >
            {title}
          </div>

          {/* Skill Pills */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
            {skills.slice(0, 4).map((skill, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  backgroundColor: '#1E293B',
                  border: '1px solid #475569',
                  padding: '6px 16px',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#CBD5E1',
                }}
              >
                {skill}
              </div>
            ))}
          </div>
        </div>

        {/* Center Details Card */}
        <div
          style={{
            backgroundColor: '#0F172A',
            border: '2px solid #1E293B',
            borderRadius: '28px',
            padding: isSquare ? '28px 36px' : '40px 48px',
            display: 'flex',
            flexDirection: 'column',
            gap: isSquare ? '18px' : '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '18px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                ELIGIBLE BATCH
              </span>
              <span style={{ fontSize: isSquare ? '28px' : '34px', color: '#F8FAFC', fontWeight: 800, marginTop: '6px' }}>
                {batch}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '18px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                LOCATION
              </span>
              <span style={{ fontSize: isSquare ? '28px' : '34px', color: '#F8FAFC', fontWeight: 800, marginTop: '6px' }}>
                {location}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderTop: '2px solid #1E293B',
              paddingTop: isSquare ? '16px' : '22px',
            }}
          >
            <span style={{ fontSize: '18px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              PACKAGE / STIPEND
            </span>
            <span style={{ fontSize: isSquare ? '32px' : '38px', color: '#10B981', fontWeight: 900, marginTop: '4px' }}>
              {salary}
            </span>
          </div>
        </div>

        {/* Bottom CTA Card with SVG Arrow (No Broken Font Glyphs) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1E1B4B',
            border: '2px solid #3B82F6',
            borderRadius: '24px',
            padding: isSquare ? '24px 32px' : '32px 40px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: isSquare ? '24px' : '28px', fontWeight: 900, color: '#FFFFFF' }}>
              Want Direct Apply Links?
            </span>
            <span style={{ fontSize: isSquare ? '18px' : '20px', color: '#93C5FD', marginTop: '4px' }}>
              Comment &quot;JOBS&quot; below for instant DM link!
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#3B82F6',
              color: '#FFFFFF',
              padding: isSquare ? '12px 24px' : '14px 28px',
              borderRadius: '16px',
              fontSize: isSquare ? '20px' : '22px',
              fontWeight: 800,
              gap: '8px',
            }}
          >
            <span>Apply Now</span>
            <svg
              width="20"
              height="20"
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
    ),
    {
      width,
      height,
    }
  );
}
