import type { Page } from "playwright";
import { chromium } from "playwright";
import type { ScrapedOffer } from "./types";
import { buildClaimUrl, cleanGameTitle, OFFER_URL } from "./utils";

const MAX_ATTEMPTS = 3;
const CARD_SELECTOR =
  '[data-a-target="offer-list-FGWP_FULL"] .item-card__action > a:first-child';

export async function scrapeOffers(): Promise<ScrapedOffer[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const offers = await scrapeOnce();
      if (offers.length > 0) return offers;
      throw new Error("Page loaded but no game offers were found");
    } catch (error) {
      lastError = error;
      console.warn(`Scrape attempt ${attempt}/${MAX_ATTEMPTS} failed:`, error);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
      }
    }
  }
  throw lastError;
}

async function scrapeOnce(): Promise<ScrapedOffer[]> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext({
      locale: "en-US",
      viewport: { width: 1920, height: 1080 },
      // Amazon serves a degraded page (or blocks) for the default headless UA.
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto(OFFER_URL, {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".offer-list__content", { timeout: 30000 });
    await dismissCookieBanner(page);

    // Switch to the "Games" tab
    const gamesTab = page.locator(
      'button[data-a-target="offer-filter-button-Game"]',
    );
    await gamesTab.waitFor({ state: "visible", timeout: 15000 });
    await gamesTab.click();
    await page.waitForSelector('[data-a-target="offer-list-FGWP_FULL"]', {
      timeout: 15000,
    });

    await scrollToBottom(page);

    // Extract all cards in a single round trip instead of one locator call
    // per field per card.
    const cards = await page.$$eval(CARD_SELECTOR, (anchors) =>
      anchors.map((anchor) => ({
        title:
          anchor.querySelector(".item-card-details__body__primary h3")
            ?.textContent ?? "",
        href: anchor.getAttribute("href") ?? "",
        imgUrl:
          (
            anchor.querySelector('[data-a-target="card-image"] img') ??
            anchor.querySelector("img")
          )?.getAttribute("src") ?? "",
      })),
    );

    if (cards.length === 0) {
      // Leave enough of a trace in the Actions log to tell "Amazon changed
      // its markup" apart from "the page didn't load".
      const pageTitle = await page.title().catch(() => "<unknown>");
      const anyCards = await page.locator(".item-card__action").count();
      const anyLists = await page
        .locator('[data-a-target^="offer-list"]')
        .count();
      console.warn(
        `No offer cards matched "${CARD_SELECTOR}". page title="${pageTitle}", ` +
          `generic cards=${anyCards}, offer lists=${anyLists} — ` +
          "Amazon may have changed its markup.",
      );
    }

    const offers: ScrapedOffer[] = [];
    for (const card of cards) {
      const title = cleanGameTitle(card.title);
      if (!title) {
        console.warn("Skipping a card without a title");
        continue;
      }
      offers.push({ title, url: buildClaimUrl(card.href), imgUrl: card.imgUrl });
    }
    return offers;
  } finally {
    await browser.close();
  }
}

async function dismissCookieBanner(page: Page): Promise<void> {
  try {
    await page
      .locator(
        '[data-a-target="sf-cookie-consent-accept"], button:has-text("Accept Cookies")',
      )
      .first()
      .click({ timeout: 3000 });
  } catch {
    // No banner shown — nothing to do.
  }
}

async function scrollToBottom(page: Page): Promise<void> {
  let previousHeight = 0;
  for (let i = 0; i < 10; i++) {
    const height = await page.evaluate(() => {
      const element = document.documentElement;
      element.scrollTop = element.scrollHeight;
      return element.scrollHeight;
    });
    if (height === previousHeight) break;
    previousHeight = height;
    await page.waitForTimeout(1000);
  }
}
