export interface CarouselSlide {
  type: 'cover' | 'job' | 'cta';
  title: string;
  subtitle?: string;
  company?: string;
  location?: string;
  salary?: string;
  skills?: string[];
  batch?: string;
  workMode?: string;
}

export interface CarouselPlan {
  headline: string;
  aspect: '1:1' | '4:5'; // 1:1 is 4x4 square ratio (1080x1080)
  slides: CarouselSlide[];
  caption: string;
}

