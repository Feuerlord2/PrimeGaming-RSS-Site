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
 * claim pages on Luna — gaming.amazon.* /claims/ URLs return 404 on any
 * locale domain, so the host is rewritten.
 */
export function buildClaimUrl(href: string): string {
  if (!href) return OFFER_URL;
  let url: URL;
  try {
    url = new URL(href, BASE_URL);
  } catch {
    return OFFER_URL;
  }
  if (
    url.pathname.includes("/claims/") &&
    url.hostname.toLowerCase().startsWith("gaming.amazon.")
  ) {
    url.hostname = "luna.amazon.de";
  }
  return url.toString();
}

/**
 * Stable identity for an offer. Claim URLs carry rotating tracking params
 * (ref_=SM_..._S01_...), so state keyed by full URL would re-stamp every
 * offer as new whenever Amazon rotates a campaign tag — the item ID in the
 * URL path is stable across those rotations.
 */
export function offerKey(url: string): string {
  return url.match(/amzn1\.pg\.item\.[0-9a-f-]+/i)?.[0].toLowerCase() ?? url;
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
    xml.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/g, "");
  return strip(a) === strip(b);
}
