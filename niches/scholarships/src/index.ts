import {
  NicheDefinition,
  StyleConfig,
  RawItem,
  RankedItemOutput,
  PostContent,
  MediaAsset,
  CollectorInterface,
  RankerInterface,
  WriterInterface,
  RendererInterface,
  RunContext,
  createSha256,
} from '@social-engine/core';

class ScholarshipCollector implements CollectorInterface {
  name = 'scholarship_portal';
  async collect(context: RunContext): Promise<RawItem[]> {
    await context.logger.info('[ScholarshipCollector] Collecting verified international and national scholarships');
    return [
      {
        source: 'daad_portal',
        externalUrl: 'https://www.daad.de/en/',
        dedupeHash: createSha256('DAAD_Germany_Masters_Full_Ride'),
        publishedAt: new Date(),
        rawData: {
          title: 'DAAD Helmut-Schmidt-Program Master Scholarship',
          funder: 'German Academic Exchange Service',
          coverage: 'Full Tuition + €934/month stipend',
          deadline: 'July 31',
        },
      },
      {
        source: 'erasmus_plus',
        externalUrl: 'https://erasmus-plus.ec.europa.eu/',
        dedupeHash: createSha256('Erasmus_Mundus_Joint_Masters'),
        publishedAt: new Date(),
        rawData: {
          title: 'Erasmus Mundus Joint Masters Full Scholarship',
          funder: 'European Union',
          coverage: '100% Tuition + Travel + €1400/month',
          deadline: 'January 15',
        },
      },
    ];
  }
}

class ScholarshipRanker implements RankerInterface {
  async rank(items: RawItem[], context: RunContext): Promise<RankedItemOutput[]> {
    await context.logger.info(`[ScholarshipRanker] Ranking ${items.length} scholarship opportunities`);
    return items.map((item) => ({
      itemId: item.dedupeHash,
      score: 95,
      reasoning: 'Prestigious global scholarship with full funding',
      extractedData: {
        title: String(item.rawData.title),
        company: String(item.rawData.funder),
        role: String(item.rawData.title),
        salary: String(item.rawData.coverage),
        deadline: String(item.rawData.deadline),
        applyUrl: item.externalUrl,
      },
      isSelected: true,
    }));
  }
}

class ScholarshipWriter implements WriterInterface {
  async writeCaptions(items: RankedItemOutput[], style: StyleConfig, context: RunContext): Promise<PostContent> {
    await context.logger.info(`[ScholarshipWriter] Drafting copy for ${items.length} scholarships`);
    return {
      headline: 'Fully Funded Scholarships Open Now',
      telegramCaption: `🎓 <b>GLOBAL SCHOLARSHIP ALERTS</b>\n\n${items.map((i) => `▪ <b>${i.extractedData.title}</b> (${i.extractedData.salary})\n🔗 <a href="${i.extractedData.applyUrl}">Apply Here</a>`).join('\n\n')}`,
      instagramCaption: `🌍 Fully Funded Scholarships You Can Apply For Right Now!\n\n${items.map((i) => `✨ ${i.extractedData.title}`).join('\n')}\n\nComment "STUDY" for application links in DM!\n\n#scholarships #studyabroad #highereducation`,
      youtubeTitle: 'Top Fully Funded International Scholarships!',
      youtubeDescription: 'Apply today before the deadline!',
      xPostText: 'Fully funded global scholarships for 2025/2026 academic year. Links in thread.',
      tags: ['scholarships', 'studyabroad', 'funding'],
    };
  }
}

class ScholarshipRenderer implements RendererInterface {
  async renderCarousel(items: RankedItemOutput[], post: PostContent, style: StyleConfig, context: RunContext): Promise<MediaAsset[]> {
    await context.logger.info('[ScholarshipRenderer] Generating scholarship carousel graphics');
    return [];
  }
}

export const defaultScholarshipStyle: StyleConfig = {
  palette: {
    primary: '#1E1B4B',
    secondary: '#312E81',
    background: '#0F172A',
    cardBackground: '#1E293B',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    accent: '#8B5CF6',
  },
  font: {
    family: 'Inter, sans-serif',
    headingWeight: '800',
    bodyWeight: '400',
  },
  layout: {
    padding: 80,
    borderRadius: 24,
    badgeStyle: 'tag',
  },
  hookFormula: 'Fully Funded Global Scholarships Open This Month',
  pacing: {
    videoDurationSeconds: 20,
    sceneDurationSeconds: 4,
  },
  brand: {
    name: 'SCHOLARSHIP RADAR',
    tagline: 'Never miss an international scholarship opportunity',
  },
};

export const scholarshipNiche: NicheDefinition = {
  name: 'scholarships',
  displayName: 'Global Scholarships',
  description: 'Curated fully funded global scholarships and educational grants',
  collectors: [new ScholarshipCollector()],
  ranker: new ScholarshipRanker(),
  writer: new ScholarshipWriter(),
  renderer: new ScholarshipRenderer(),
  defaultStyle: defaultScholarshipStyle,
  thresholds: {
    minItemsToPost: 1,
    maxItemsPerCarousel: 5,
  },
  deduplicate: (item) => item.dedupeHash,
};

export default scholarshipNiche;
