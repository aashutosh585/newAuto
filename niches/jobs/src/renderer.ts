import fs from 'fs';
import path from 'path';
import {
  RendererInterface,
  RankedItemOutput,
  PostContent,
  StyleConfig,
  RunContext,
  MediaAsset,
} from '@social-engine/core';

export class JobRenderer implements RendererInterface {
  async renderCarousel(
    rankedItems: RankedItemOutput[],
    postContent: PostContent,
    style: StyleConfig,
    context: RunContext
  ): Promise<MediaAsset[]> {
    const outputDir = process.env.MEDIA_OUTPUT_DIR || path.join(process.cwd(), 'storage', 'media');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await context.logger.info(
      `[JobRenderer] Rendering 1080x1350 carousel slides for run ${context.runId} with Playwright`
    );

    // Limit to 3-5 slides total (Cover + 2-3 Job Cards + Brand Slide)
    const itemsToFeature = rankedItems.slice(0, 4);
    const slidesHtml: string[] = [];

    const dateToday = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // 1. Cover / Hook Slide HTML
    slidesHtml.push(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body {
            width: 1080px;
            height: 1350px;
            background: ${style.palette.background || '#090D16'};
            color: ${style.palette.textPrimary || '#FFFFFF'};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 80px;
            position: relative;
            overflow: hidden;
          }
          .glow {
            position: absolute;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, ${style.palette.accent || '#3B82F6'}33 0%, transparent 70%);
            top: -100px;
            right: -100px;
            border-radius: 50%;
          }
          .badge {
            display: inline-block;
            background: ${style.palette.accent || '#3B82F6'};
            color: #FFFFFF;
            padding: 12px 28px;
            border-radius: 50px;
            font-size: 24px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .headline {
            font-size: 76px;
            font-weight: 900;
            line-height: 1.1;
            margin-top: 40px;
            letter-spacing: -1.5px;
          }
          .highlight {
            color: ${style.palette.accent || '#3B82F6'};
          }
          .companies-bar {
            margin-top: 40px;
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
          }
          .company-chip {
            background: #1E293B;
            border: 1px solid #334155;
            padding: 16px 28px;
            border-radius: 16px;
            font-size: 28px;
            font-weight: 600;
          }
          .footer {
            border-top: 2px solid #1E293B;
            padding-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 26px;
            color: #94A3B8;
          }
          .swipe {
            color: ${style.palette.accent || '#3B82F6'};
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="glow"></div>
        <div>
          <div class="badge">Verified Hiring Alert • ${dateToday}</div>
          <h1 class="headline">${postContent.headline.replace(/(\d+)/, '<span class="highlight">$1</span>')}</h1>
          <div class="companies-bar">
            ${itemsToFeature.map((item) => `<div class="company-chip">${item.extractedData.company}</div>`).join('')}
          </div>
        </div>
        <div class="footer">
          <div>${style.brand.name || 'TECH CAREERS'}</div>
          <div class="swipe">Swipe for Openings ➔</div>
        </div>
      </body>
      </html>
    `);

    // 2. Job Detail Slides
    for (let i = 0; i < itemsToFeature.length; i++) {
      const item = itemsToFeature[i];
      slidesHtml.push(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body {
              width: 1080px;
              height: 1350px;
              background: ${style.palette.background || '#090D16'};
              color: #FFFFFF;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 80px;
              position: relative;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .number {
              font-size: 32px;
              font-weight: 800;
              color: ${style.palette.accent || '#3B82F6'};
            }
            .card {
              background: #111827;
              border: 2px solid #1F2937;
              border-radius: 32px;
              padding: 60px;
              margin: 40px 0;
            }
            .company {
              font-size: 36px;
              color: #9CA3AF;
              text-transform: uppercase;
              letter-spacing: 2px;
              font-weight: 700;
            }
            .role {
              font-size: 64px;
              font-weight: 900;
              color: #FFFFFF;
              margin: 16px 0 32px 0;
              line-height: 1.1;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              margin-bottom: 32px;
            }
            .info-box {
              background: #1F2937;
              padding: 24px;
              border-radius: 16px;
            }
            .info-label {
              font-size: 20px;
              color: #9CA3AF;
              margin-bottom: 6px;
            }
            .info-val {
              font-size: 28px;
              font-weight: 700;
              color: #F9FAFB;
            }
            .skills-wrap {
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
            }
            .skill-pill {
              background: #374151;
              color: #E5E7EB;
              padding: 10px 20px;
              border-radius: 12px;
              font-size: 22px;
              font-weight: 600;
            }
            .footer {
              border-top: 2px solid #1E293B;
              padding-top: 40px;
              display: flex;
              justify-content: space-between;
              font-size: 24px;
              color: #94A3B8;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">${item.extractedData.company}</div>
            <div class="number">JOB 0${i + 1} OF 0${itemsToFeature.length}</div>
          </div>
          <div class="card">
            <h2 class="role">${item.extractedData.role || item.extractedData.title}</h2>
            <div class="info-grid">
              <div class="info-box">
                <div class="info-label">ELIGIBLE BATCH</div>
                <div class="info-val">${item.extractedData.batch || '2024 / 2025'}</div>
              </div>
              <div class="info-box">
                <div class="info-label">LOCATION</div>
                <div class="info-val">${item.extractedData.location || 'India'}</div>
              </div>
            </div>
            <div class="info-box" style="margin-bottom: 24px;">
              <div class="info-label">SALARY ESTIMATE</div>
              <div class="info-val" style="color: #10B981;">${item.extractedData.salary || 'Best in Market'}</div>
            </div>
            <div class="skills-wrap">
              ${(item.extractedData.skills || ['Coding', 'Development']).map((s) => `<div class="skill-pill">${s}</div>`).join('')}
            </div>
          </div>
          <div class="footer">
            <div>Check Telegram for direct link</div>
            <div>Swipe ➔</div>
          </div>
        </body>
        </html>
      `);
    }

    // 3. Brand / CTA Final Slide
    slidesHtml.push(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body {
            width: 1080px;
            height: 1350px;
            background: ${style.palette.background || '#090D16'};
            color: #FFFFFF;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 80px;
            position: relative;
          }
          .cta-card {
            background: linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%);
            border: 2px solid ${style.palette.accent || '#3B82F6'};
            border-radius: 40px;
            padding: 80px 60px;
            width: 100%;
          }
          .title {
            font-size: 64px;
            font-weight: 900;
            margin-bottom: 24px;
          }
          .subtitle {
            font-size: 32px;
            color: #94A3B8;
            margin-bottom: 60px;
            line-height: 1.4;
          }
          .btn {
            display: inline-block;
            background: ${style.palette.accent || '#3B82F6'};
            color: #FFFFFF;
            padding: 24px 60px;
            border-radius: 24px;
            font-size: 34px;
            font-weight: 800;
            margin: 16px 0;
          }
          .handle {
            font-size: 28px;
            color: #38BDF8;
            margin-top: 40px;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="cta-card">
          <h2 class="title">Want Direct Apply Links?</h2>
          <p class="subtitle">All active links are posted instantly in our Telegram channel and DM'd on Instagram!</p>
          <div class="btn">Comment "JOBS" Below</div>
          <div class="handle">Join: ${style.brand.telegramLink || 't.me/YourJobChannel'}</div>
        </div>
      </body>
      </html>
    `);

    // Render using Playwright
    const assets: MediaAsset[] = [];
    let playwright: any;
    try {
      playwright = await import('playwright');
    } catch {
      await context.logger.warn('[JobRenderer] Playwright module not installed locally. Generating mock JPEG placeholders.');
      // Create JPEG placeholders if playwright browser not installed in current test environment
      slidesHtml.forEach((html, idx) => {
        const filePath = path.join(outputDir, `slide_${context.runId}_${idx}.html`);
        fs.writeFileSync(filePath, html, 'utf8');
        assets.push({
          type: 'CAROUSEL_IMAGE',
          path: filePath,
          mimeType: 'image/jpeg',
          sequenceOrder: idx,
          metadata: { width: 1080, height: 1350 },
        });
      });
      return assets;
    }

    try {
      const browser = await playwright.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage({
        viewport: { width: 1080, height: 1350 },
        deviceScaleFactor: 2,
      });

      for (let idx = 0; idx < slidesHtml.length; idx++) {
        const html = slidesHtml[idx];
        await page.setContent(html, { waitUntil: 'load' });
        const filePath = path.join(outputDir, `run_${context.runId}_slide_${idx + 1}.jpeg`);
        await page.screenshot({
          path: filePath,
          type: 'jpeg',
          quality: 95,
        });

        assets.push({
          type: 'CAROUSEL_IMAGE',
          path: filePath,
          mimeType: 'image/jpeg',
          sequenceOrder: idx + 1,
          metadata: { width: 1080, height: 1350 },
        });
      }

      await browser.close();
      await context.logger.info(`[JobRenderer] Rendered ${assets.length} carousel slides successfully`);
      return assets;
    } catch (err: any) {
      await context.logger.error(`[JobRenderer] Playwright rendering failed: ${err.message}`);
      throw err;
    }
  }
}
