/** A free game offer as shown on the Prime Gaming page. */
export interface ScrapedOffer {
  title: string;
  url: string;
  imgUrl: string;
}

/** A scraped offer enriched with the date it first appeared in the feed. */
export interface GameOffer extends ScrapedOffer {
  /** ISO 8601 timestamp of when this offer was first seen. */
  seenFirst: string;
}
