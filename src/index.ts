import fs from 'fs/promises';
import path from 'path';
import { AmazonGamesScraper } from './scraper';
import { createRSSFeed } from './rss';

async function main() {
  console.log('Starting Prime Gaming RSS scraper...');
  
  try {
    const scraper = new AmazonGamesScraper();
    console.log('Scraping games...');
    
    const offers = await scraper.readOffers();
    console.log(`Found ${offers.length} game offers`);
    
    if (offers.length === 0) {
      console.warn('No offers found, creating empty feed');
      // Create a dummy offer
      offers.push({
        source: scraper.getSource(),
        duration: scraper.getDuration(),
        type: scraper.getType(),
        platform: scraper.getPlatform(),
        title: 'No games available',
        probable_game_name: 'No games available',
        seen_last: new Date().toISOString(),
        seen_first: new Date().toISOString(),
        valid_to: null,
        rawtext: JSON.stringify({ title: 'No games available' }),
        url: 'https://gaming.amazon.com/home',
        img_url: '',
      });
    }
    
    const rssContent = createRSSFeed(offers);
    
    // Ensure docs directory exists
    const docsDir = path.join(process.cwd(), 'docs');
    await fs.mkdir(docsDir, { recursive: true });
    
    // Write RSS file
    const rssPath = path.join(docsDir, 'games.rss');
    await fs.writeFile(rssPath, rssContent, 'utf8');
    
    console.log(`RSS feed written to ${rssPath}`);
    console.log('Scraping completed successfully!');
    
  } catch (error) {
    console.error('Scraping failed:', error);
    process.exit(1);
  }
}

main();
