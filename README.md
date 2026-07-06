# PrimeGaming-RSS-Site

RSS feed for free games available through Amazon Prime Gaming. Scrapes the Prime Gaming page every 8 hours using Playwright and generates an RSS feed.

**Live:** https://feuerlord2.github.io/PrimeGaming-RSS-Site/

## Feed

```
https://feuerlord2.github.io/PrimeGaming-RSS-Site/games.rss
```

Add this to any RSS reader or Discord bot. Each item links directly to the Amazon claim page (requires Prime membership).

## How it works

A TypeScript scraper launches a headless Chromium browser via Playwright, navigates to `gaming.amazon.com/home`, finds all claimable game offers, extracts titles, images and claim URLs, and writes them as an RSS 2.0 feed. GitHub Actions runs this on a schedule and commits the updated feed to `docs/`.

The scraper is designed to run unattended:

- **Stable dates** — `data/state.json` remembers when each offer was first seen, so feed items keep their original `pubDate` across runs.
- **No noise commits** — the feed is only rewritten (and committed) when the set of offers actually changes.
- **Failure-safe** — scraping retries up to 3 times; if it still fails or finds zero offers, the previous feed is left untouched so subscribers never see an empty feed.
- **CI validation** — pull requests build and run the unit tests without scraping or committing.

## Running locally

```
npm install
npx playwright install chromium
npm run build
npm start
```

Requires Node 20+. Output goes to `docs/games.rss`. Run the tests with `npm test`.

## Project structure

```
src/
  index.ts       Entry point — orchestrates scraping, state and RSS generation
  scraper.ts     Playwright scraper for the Prime Gaming page
  rss.ts         RSS feed generator
  state.ts       Persists first-seen dates between runs
  types.ts       TypeScript interfaces
  utils.ts       URL/title helpers and feed comparison
tests/           Unit tests (vitest)
data/            Scraper state (first-seen dates per offer)
docs/            GitHub Pages output (HTML + RSS)
```

## Disclaimer

Not affiliated with Amazon. This is a private hobby project.

## License

MIT — see [LICENSE](LICENSE).
