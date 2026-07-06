import { describe, expect, it } from "vitest";
import { createRSSFeed } from "../src/rss";
import type { GameOffer } from "../src/types";

const offer: GameOffer = {
  title: "Terraforming Mars",
  url: "https://luna.amazon.de/claims/terraforming-mars",
  imgUrl: "https://images.example/tm.jpg",
  seenFirst: "2026-07-01T12:00:00.000Z",
};

describe("createRSSFeed", () => {
  it("produces a valid RSS document with the offer as an item", () => {
    const xml = createRSSFeed([offer]);
    expect(xml).toContain("<rss");
    expect(xml).toContain("Terraforming Mars");
    expect(xml).toContain(
      "https://luna.amazon.de/claims/terraforming-mars",
    );
    expect(xml).toContain("Wed, 01 Jul 2026 12:00:00 GMT");
    expect(xml).toContain("https://images.example/tm.jpg");
  });

  it("produces an empty channel for no offers", () => {
    const xml = createRSSFeed([]);
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });

  it("is deterministic apart from lastBuildDate", () => {
    const strip = (xml: string) =>
      xml.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/, "");
    expect(strip(createRSSFeed([offer]))).toBe(strip(createRSSFeed([offer])));
  });
});
