import RSS from "rss";
import type { GameOffer } from "./types";
import { escapeHtml, sortOffers } from "./utils";

const SITE_URL = "https://feuerlord2.github.io/PrimeGaming-RSS-Site/";

export function createRSSFeed(offers: GameOffer[]): string {
  const feed = new RSS({
    title: "Prime Gaming RSS Games",
    description: "Free games currently claimable with Amazon Prime Gaming.",
    site_url: SITE_URL,
    feed_url: `${SITE_URL}games.rss`,
    managingEditor: "DanielWinterEmsdetten+rss@gmail.com (Daniel Winter)",
    webMaster: "DanielWinterEmsdetten+rss@gmail.com (Daniel Winter)",
    language: "en",
    ttl: 480,
  });

  for (const offer of sortOffers(offers)) {
    const title = escapeHtml(offer.title);
    const image = offer.imgUrl
      ? `<p><img src="${escapeHtml(offer.imgUrl)}" alt="${title}"/></p>`
      : "";
    feed.item({
      title: offer.title,
      description: `${image}<p>${title} is currently free to claim with Prime Gaming.</p>`,
      url: offer.url,
      guid: offer.url,
      date: offer.seenFirst,
    });
  }

  return feed.xml();
}
