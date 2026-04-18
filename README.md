# PrimeGaming-RSS-Site

RSS feed for free games available through Amazon Prime Gaming. Scrapes the Prime Gaming page every 8 hours using Playwright and generates an RSS feed.

**Live:** https://feuerlord2.github.io/PrimeGaming-RSS-Site/

## Feed

```
https://feuerlord2.github.io/PrimeGaming-RSS-Site/games.rss
```

Add this to any RSS reader or Discord bot. Each item links directly to the Amazon claim page (requires Prime membership).

## How it works

A TypeScript scraper launches a headless Chromium browser via Playwright, navigates to `gaming.amazon.com/home`, finds all claimable game offers, extracts titles and claim URLs, and writes them as an RSS 2.0 feed. GitHub Actions runs this on a schedule and commits the updated feed to `docs/`.

## Running locally

```
npm install
npx playwright install chromium
npm run build
npm start
```

Requires Node 18+. Output goes to `docs/games.rss`.

## Project structure

```
src/
  index.ts       Entry point — orchestrates scraping and RSS generation
  scraper.ts     Playwright scraper for Prime Gaming page
  rss.ts         RSS feed generator
  types.ts       TypeScript interfaces and enums
  utils.ts       Helper functions
docs/            GitHub Pages output (HTML + RSS)
```

## Disclaimer

Not affiliated with Amazon. This is a private hobby project.

## License

MIT — see [LICENSE](LICENSE).
