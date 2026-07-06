import fs from "fs/promises";
import path from "path";
import { createRSSFeed } from "./rss";
import { scrapeOffers } from "./scraper";
import { loadState, mergeState, saveState } from "./state";
import type { GameOffer } from "./types";
import { feedsEqual, offerKey } from "./utils";

const RSS_PATH = path.join(process.cwd(), "docs", "games.rss");
const STATE_PATH = path.join(process.cwd(), "data", "state.json");

async function main(): Promise<void> {
  console.log("Scraping Prime Gaming offers...");
  const scraped = await scrapeOffers();
  console.log(`Found ${scraped.length} game offers`);

  // Preserve first-seen dates across runs so items keep stable pubDates and
  // the feed (and git history) only changes when the offers actually change.
  const previous = await loadState(STATE_PATH);
  const now = new Date().toISOString();
  const offers: GameOffer[] = scraped.map((offer) => ({
    ...offer,
    seenFirst: previous[offerKey(offer.url)]?.first ?? now,
  }));

  const added = offers.filter((offer) => !previous[offerKey(offer.url)]);
  if (added.length > 0) {
    console.log(`New offers: ${added.map((offer) => offer.title).join(", ")}`);
  }

  const rssContent = createRSSFeed(offers);
  const existing = await fs.readFile(RSS_PATH, "utf8").catch(() => "");
  if (feedsEqual(existing, rssContent)) {
    console.log("Offers unchanged — feed left as is.");
    return;
  }

  await fs.mkdir(path.dirname(RSS_PATH), { recursive: true });
  await fs.writeFile(RSS_PATH, rssContent, "utf8");
  await saveState(
    STATE_PATH,
    mergeState(previous, offers.map((offer) => offerKey(offer.url)), now),
  );
  console.log(`RSS feed written to ${RSS_PATH}`);
}

main().catch((error) => {
  // Leaves the previous feed untouched so subscribers never see it go empty.
  console.error("Scraping failed:", error);
  process.exitCode = 1;
});
