import type { GameOffer } from "./types";

export const BASE_URL = "https://gaming.amazon.com";
export const OFFER_URL = `${BASE_URL}/home`;

export function cleanGameTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Turn a card's href into an absolute claim URL. Amazon serves Prime Gaming
 * claim pages on Luna — gaming.amazon.com/claims/* URLs return 404, so the
 * domain is rewritten.
 */
export function buildClaimUrl(href: string): string {
  if (!href) return OFFER_URL;
  let url = href.startsWith("http") ? href : BASE_URL + href;
  if (url.includes("/claims/")) {
    url = url.replace(
      /^https?:\/\/gaming\.amazon\.(com|de)/i,
      "https://luna.amazon.de",
    );
  }
  return url;
}

/**
 * Deterministic feed order: newest offers first, ties broken by title, so the
 * feed only changes when the offers themselves change — not when Amazon
 * shuffles the page.
 */
export function sortOffers(offers: GameOffer[]): GameOffer[] {
  return [...offers].sort(
    (a, b) =>
      b.seenFirst.localeCompare(a.seenFirst) || a.title.localeCompare(b.title),
  );
}

/** Compare two feeds ignoring the always-changing lastBuildDate. */
export function feedsEqual(a: string, b: string): boolean {
  const strip = (xml: string) =>
    xml.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/, "");
  return strip(a) === strip(b);
}
