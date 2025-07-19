import RSS from 'rss';
import { NewOffer } from './types';

export function createRSSFeed(offers: Omit<NewOffer, "category">[]): string {
  const feed = new RSS({
    title: 'Prime Gaming RSS Games',
    description: 'Awesome RSS Feeds about Prime Gaming games offers!',
    site_url: 'https://feuerlord2.github.io/PrimeGaming-RSS-Site/',
    feed_url: 'https://feuerlord2.github.io/PrimeGaming-RSS-Site/games.rss',
    managingEditor: 'DanielWinterEmsdetten+rss@gmail.com (Daniel Winter)',
    webMaster: 'DanielWinterEmsdetten+rss@gmail.com (Daniel Winter)',
    language: 'en',
  });

  for (const offer of offers) {
    feed.item({
      title: offer.title,
      description: offer.title,
      url: offer.url,
      guid: offer.url,
      date: offer.seen_first,
    });
  }

  return feed.xml();
}
