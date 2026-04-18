import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { chromium } from "playwright";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "./types";
import type { NewOffer, AmazonBaseOffer } from "./types";
import { cleanGameTitle } from "./utils";

const BASE_URL = "https://gaming.amazon.com";
export const OFFER_URL = `${BASE_URL}/home`;

export class AmazonGamesScraper {
  getScraperName(): string {
    return "AmazonGames";
  }

  getSource(): OfferSource {
    return OfferSource.AMAZON;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  getPlatform(): OfferPlatform {
    return OfferPlatform.PC;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  async readOffers(): Promise<Omit<NewOffer, "category">[]> {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(OFFER_URL, { timeout: 30000 });
      
      // Wait for page content
      await page.waitForSelector(".offer-list__content", { timeout: 30000 });
      
      // Switch to the "Games" tab
      const gamesTab = page.locator('button[data-a-target="offer-filter-button-Game"]');
      await gamesTab.click();
      
      // Scroll to load all content
      await this.scrollElementToBottom(page);
      
      // Find all game offers
      const gameElements = page.locator('[data-a-target="offer-list-FGWP_FULL"] .item-card__action > a:first-child');
      
      const offers: Omit<NewOffer, "category">[] = [];
      const count = await gameElements.count();
      
      for (let i = 0; i < count; i++) {
        const element = gameElements.nth(i);
        try {
          const offer = await this.readOffer(element);
          if (offer) {
            offers.push(offer);
          }
        } catch (error) {
          console.error(`Failed to read offer ${i}:`, error);
        }
      }
      
      await context.close();
      return offers;
    } finally {
      await browser.close();
    }
  }

  private async scrollElementToBottom(page: Page): Promise<void> {
    await page.evaluate(() => {
      const scrollableElement = document.documentElement;
      scrollableElement.scrollTop = scrollableElement.scrollHeight;
    });
    
    // Wait for potential lazy loading
    await page.waitForTimeout(2000);
  }

  private async readOffer(element: Locator): Promise<Omit<NewOffer, "category"> | null> {
    try {
      const baseOffer = await this.readBaseOffer(element);

      return {
        source: this.getSource(),
        duration: this.getDuration(),
        type: this.getType(),
        platform: this.getPlatform(),
        title: cleanGameTitle(baseOffer.title),
        probable_game_name: cleanGameTitle(baseOffer.title),
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        valid_to: null, // Prime Gaming games usually don't expire
        rawtext: JSON.stringify({
          title: baseOffer.title,
        }),
        url: baseOffer.url,
        img_url: baseOffer.imgUrl,
      };
    } catch (error) {
      console.error(`Failed to read offer:`, error);
      return null;
    }
  }

  private async readBaseOffer(element: Locator): Promise<AmazonBaseOffer> {
    const title = await element
      .locator(".item-card-details__body__primary h3")
      .textContent();
    if (!title) throw new Error("Couldn't find title");

    // More robust image URL extraction with fallback
    let imgUrl: string;
    try {
      imgUrl = await element
        .locator('[data-a-target="card-image"] img')
        .getAttribute("src", { timeout: 5000 }) || "";
    } catch {
      // Fallback to any img in the card
      try {
        imgUrl = await element
          .locator("img")
          .first()
          .getAttribute("src", { timeout: 5000 }) || "";
      } catch {
        imgUrl = ""; // No image found, but don't fail
      }
    }

    let url = BASE_URL + "/home";
    try {
      const href = await element.getAttribute("href", { timeout: 5000 });
      if (href) {
        url = href.startsWith("http") ? href : BASE_URL + href;
      }
      // Amazon moved Prime Gaming claim pages to Luna — rewrite the domain so
      // /claims/... URLs resolve instead of returning 404.
      if (url.includes("/claims/")) {
        url = url.replace(
          /^https?:\/\/gaming\.amazon\.(com|de)/i,
          "https://luna.amazon.de",
        );
      }
    } catch {
      console.warn(`Couldn't find detail page for ${title}`);
    }

    // Skip date extraction for now - Prime Gaming doesn't show expiry dates in main list
    // Most games don't expire anyway, they're permanent additions to your library

    return {
      title,
      url,
      imgUrl,
      // No validTo date - most Prime Gaming games are permanent
    };
  }

}
