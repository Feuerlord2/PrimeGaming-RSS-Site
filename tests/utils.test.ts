import { describe, expect, it } from "vitest";
import {
  buildClaimUrl,
  cleanGameTitle,
  escapeHtml,
  feedsEqual,
  offerKey,
  OFFER_URL,
  sortOffers,
} from "../src/utils";

describe("cleanGameTitle", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanGameTitle("  Space   Grunts\n2 ")).toBe("Space Grunts 2");
  });
});

describe("escapeHtml", () => {
  it("escapes special characters", () => {
    expect(escapeHtml('<b>"Fish & Chips"</b>')).toBe(
      "&lt;b&gt;&quot;Fish &amp; Chips&quot;&lt;/b&gt;",
    );
  });
});

describe("buildClaimUrl", () => {
  it("prefixes relative hrefs with the base URL", () => {
    expect(buildClaimUrl("/some-game")).toBe(
      "https://gaming.amazon.com/some-game",
    );
  });

  it("rewrites claim URLs to the Luna domain", () => {
    expect(buildClaimUrl("/claims/some-game/dp/abc?g=s")).toBe(
      "https://luna.amazon.de/claims/some-game/dp/abc?g=s",
    );
    expect(buildClaimUrl("https://gaming.amazon.com/claims/x")).toBe(
      "https://luna.amazon.de/claims/x",
    );
  });

  it("keeps absolute non-claim URLs unchanged", () => {
    expect(buildClaimUrl("https://gaming.amazon.com/home")).toBe(
      "https://gaming.amazon.com/home",
    );
  });

  it("rewrites claim URLs on any gaming.amazon locale domain", () => {
    expect(buildClaimUrl("https://gaming.amazon.co.uk/claims/x")).toBe(
      "https://luna.amazon.de/claims/x",
    );
  });

  it("resolves protocol-relative hrefs", () => {
    expect(buildClaimUrl("//gaming.amazon.com/claims/x")).toBe(
      "https://luna.amazon.de/claims/x",
    );
  });

  it("falls back to the offers page for missing hrefs", () => {
    expect(buildClaimUrl("")).toBe(OFFER_URL);
  });
});

describe("offerKey", () => {
  it("extracts the stable item ID, ignoring tracking params", () => {
    const key = "amzn1.pg.item.34a07e29-18da-495f-9673-266fd4722390";
    expect(
      offerKey(`https://luna.amazon.de/claims/x/dp/${key}?g=s&ref_=SM_X_S01`),
    ).toBe(key);
    expect(
      offerKey(`https://luna.amazon.de/claims/x/dp/${key}?ref_=SM_X_S02`),
    ).toBe(key);
  });

  it("falls back to the full URL when no item ID is present", () => {
    expect(offerKey("https://example.com/game")).toBe(
      "https://example.com/game",
    );
  });
});

describe("sortOffers", () => {
  it("sorts newest first, then by title", () => {
    const offers = [
      { title: "B", url: "b", imgUrl: "", seenFirst: "2026-01-01T00:00:00Z" },
      { title: "A", url: "a", imgUrl: "", seenFirst: "2026-01-01T00:00:00Z" },
      { title: "C", url: "c", imgUrl: "", seenFirst: "2026-02-01T00:00:00Z" },
    ];
    expect(sortOffers(offers).map((offer) => offer.title)).toEqual([
      "C",
      "A",
      "B",
    ]);
  });

  it("does not mutate its input", () => {
    const offers = [
      { title: "B", url: "b", imgUrl: "", seenFirst: "2026-01-01T00:00:00Z" },
      { title: "A", url: "a", imgUrl: "", seenFirst: "2026-02-01T00:00:00Z" },
    ];
    sortOffers(offers);
    expect(offers[0].title).toBe("B");
  });
});

describe("feedsEqual", () => {
  const feed = (buildDate: string, item: string) =>
    `<rss><channel><lastBuildDate>${buildDate}</lastBuildDate><item>${item}</item></channel></rss>`;

  it("ignores lastBuildDate differences", () => {
    expect(feedsEqual(feed("Mon, 1 Jan", "Game"), feed("Tue, 2 Jan", "Game"))).toBe(
      true,
    );
  });

  it("detects item differences", () => {
    expect(
      feedsEqual(feed("Mon, 1 Jan", "Game A"), feed("Mon, 1 Jan", "Game B")),
    ).toBe(false);
  });
});
