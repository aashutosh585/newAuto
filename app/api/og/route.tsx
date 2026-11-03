import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const title = searchParams.get('title') || 'Software Engineer Fresher';
  const company = searchParams.get('company') || 'TECH COMPANY';
  const location = searchParams.get('location') || 'Remote / India';
  const batch = searchParams.get('batch') || '2024 / 2025 Graduates';
  const salary = searchParams.get('salary') || 'Competitive CTC';
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1350px',
          backgroundColor: '#090D16',
          backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(37, 99, 235, 0.35) 0%, transparent 60%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
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
              padding: '12px 28px',
              borderRadius: '50px',
              alignSelf: 'flex-start',
              color: '#38BDF8',
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            ⚡ VERIFIED HIRING • {dateStr}
          </div>

          <div
            style={{
              fontSize: '36px',
              fontWeight: 800,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              marginTop: '50px',
            }}
          >
            {company}
          </div>

          <div
            style={{
              fontSize: '68px',
              fontWeight: 900,
              lineHeight: 1.15,
              color: '#FFFFFF',
              marginTop: '16px',
              letterSpacing: '-1.5px',
            }}
          >
            {title}
          </div>
        </div>

        {/* Center Details Card */}
        <div
          style={{
            backgroundColor: '#0F172A',
            border: '2px solid #1E293B',
            borderRadius: '32px',
            padding: '50px',
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '22px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                ELIGIBLE BATCH
              </span>
              <span style={{ fontSize: '36px', color: '#F8FAFC', fontWeight: 800, marginTop: '8px' }}>
                {batch}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '22px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                LOCATION
              </span>
              <span style={{ fontSize: '36px', color: '#F8FAFC', fontWeight: 800, marginTop: '8px' }}>
                {location}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderTop: '2px solid #1E293B',
              paddingTop: '28px',
            }}
          >
            <span style={{ fontSize: '22px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              PACKAGE / STIPEND
            </span>
            <span style={{ fontSize: '38px', color: '#10B981', fontWeight: 900, marginTop: '8px' }}>
              {salary}
            </span>
          </div>
        </div>

        {/* Bottom CTA Card */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1E1B4B',
            border: '2px solid #3B82F6',
            borderRadius: '28px',
            padding: '36px 44px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#FFFFFF' }}>
              Want Direct Apply Links?
            </span>
            <span style={{ fontSize: '22px', color: '#93C5FD', marginTop: '6px' }}>
              Comment &quot;JOBS&quot; below for instant DM link!
            </span>
          </div>
          <div
            style={{
              backgroundColor: '#3B82F6',
              color: '#FFFFFF',
              padding: '16px 32px',
              borderRadius: '20px',
              fontSize: '24px',
              fontWeight: 800,
            }}
          >
            Apply Now ➔
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
    }
  );
}
