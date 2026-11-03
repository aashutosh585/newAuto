import { Publisher, ChannelType } from './interface.js';
import { ZernioPublisher } from './zernio.js';
import { PostmillPublisher } from './postmill.js';
import { TelegramPublisher } from './telegram.js';
import { InstagramPublisher } from './instagram.js';

export class PublisherFactory {
  private static zernio = new ZernioPublisher();
  private static postmill = new PostmillPublisher();
  private static directTelegram = new TelegramPublisher();
  private static directInstagram = new InstagramPublisher();

  static getPublisher(channel: ChannelType, overrideType?: 'zernio' | 'postmill' | 'direct'): Publisher {
    const publisherType = overrideType || (process.env.PUBLISHER_TYPE || 'zernio').toLowerCase();

    if (publisherType === 'zernio' && process.env.ZERNIO_API_KEY) {
      return this.zernio;
    }

    if (publisherType === 'postmill' && process.env.POSTMILL_API_KEY) {
      return this.postmill;
    }

    // Direct fallback
    switch (channel) {
      case 'telegram':
        return this.directTelegram;
      case 'instagram':
        return this.directInstagram;
      default:
        return this.zernio;
    }
  }

  static getZernio(): ZernioPublisher {
    return this.zernio;
  }
}
