package goprimegaming

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
	"github.com/gorilla/feeds"
	log "github.com/sirupsen/logrus"
)

func Run() {
	wg := sync.WaitGroup{}
	for _, category := range []string{"games", "loot"} {
		wg.Add(1)
		go updateCategory(&wg, category)
	}
	wg.Wait()
}

func createFeed(products []Product, category string) (feeds.Feed, error) {
	feed := feeds.Feed{
		Title:       fmt.Sprintf("Prime Gaming RSS %s", strings.ToTitle(category)),
		Link:        &feeds.Link{Href: "https://feuerlord2.github.io/PrimeGaming-RSS-Site/"},
		Description: fmt.Sprintf("Awesome RSS Feeds about Prime Gaming %s offers!", category),
		Author:      &feeds.Author{Name: "Daniel Winter", Email: "DanielWinterEmsdetten+rss@gmail.com"},
		Created:     time.Now(),
	}

	feed.Items = make([]*feeds.Item, len(products))
	for idx, product := range products {
		var dt time.Time
		var err error
		if product.StartDateDatetime != "" {
			layouts := []string{
				time.RFC3339,
				"2006-01-02T15:04:05",
				"2006-01-02T15:04:05Z",
				"2006-01-02 15:04:05",
			}
			
			dateStr := product.StartDateDatetime
			if !strings.HasSuffix(dateStr, "Z") && !strings.Contains(dateStr, "+") {
				dateStr += "Z"
			}
			
			for _, layout := range layouts {
				dt, err = time.Parse(layout, dateStr)
				if err == nil {
					break
				}
			}
			
			if err != nil {
				dt = time.Now()
			}
		} else {
			dt = time.Now()
		}

		title := product.TileShortName
		if title == "" {
			title = product.TileName
		}

		feed.Items[idx] = &feeds.Item{
			Title:       title,
			Link:        &feeds.Link{Href: fmt.Sprintf("https://gaming.amazon.com%s", product.ProductURL)},
			Content:     product.DetailedMarketingBlurb,
			Created:     dt,
			Description: product.ShortMarketingBlurb,
		}
	}

	sort.Slice(feed.Items, func(i, j int) bool { 
		return feed.Items[i].Created.After(feed.Items[j].Created) 
	})

	return feed, nil
}

func scrapeWithBrowser(category string) ([]Product, error) {
	var products []Product
	
	// Create context with options for GitHub Actions/CI environment
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.NoSandbox,
		chromedp.DisableGPU,
		chromedp.NoFirstRun,
		chromedp.NoDefaultBrowserCheck,
		chromedp.Headless,
		chromedp.Flag("disable-dev-shm-usage", true),
	)
	
	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()
	
	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	// Set timeout
	ctx, cancel = context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	var htmlContent string
	
	err := chromedp.Run(ctx,
		// Navigate to the page
		chromedp.Navigate("https://gaming.amazon.com/home"),
		
		// Wait for page to load
		chromedp.WaitVisible(".offer-list__content", chromedp.ByQuery),
		
		// Click on the appropriate tab based on category
		chromedp.ActionFunc(func(ctx context.Context) error {
			if category == "games" {
				// Click on Games tab
				if err := chromedp.Click(`button[data-a-target="offer-filter-button-Game"]`, chromedp.ByQuery).Do(ctx); err != nil {
					return err
				}
				
				// Wait for tab to load
				time.Sleep(1 * time.Second)
				
				// Try to remove any filters or show all
				filterSelectors := []string{
					`button[data-a-target="show-all"]`,
					`button[data-a-target="clear-filters"]`,
					`button:contains("Show All")`,
					`button:contains("View All")`,
					`button:contains("See All")`,
					`[data-a-target*="all"]`,
				}
				
				for _, selector := range filterSelectors {
					chromedp.Click(selector, chromedp.ByQuery).Do(ctx)
					// Don't care if it fails, just try all
				}
			}
			return nil
		}),
		
		// Wait a bit for content to load after tab click
		chromedp.Sleep(2*time.Second),
		
		// Scroll to bottom to load all content
		chromedp.ActionFunc(func(ctx context.Context) error {
			// Scroll down multiple times to trigger lazy loading
			for i := 0; i < 3; i++ {
				if err := chromedp.Evaluate(`
					window.scrollTo(0, document.body.scrollHeight);
				`, nil).Do(ctx); err != nil {
					return err
				}
				// Wait between scrolls
				time.Sleep(1 * time.Second)
			}
			return nil
		}),
		
		// Wait for content to load after scrolling
		chromedp.Sleep(5*time.Second),
		
		// Get the HTML content
		chromedp.OuterHTML("html", &htmlContent),
	)

	if err != nil {
		return products, fmt.Errorf("failed to scrape with browser: %v", err)
	}

	// Parse the HTML with goquery
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return products, fmt.Errorf("failed to parse HTML: %v", err)
	}

	return parseProducts(doc, category)
}

func parseProducts(doc *goquery.Document, category string) ([]Product, error) {
	var products []Product

	switch category {
	case "games":
		// Look for free games section
		selector := `[data-a-target="offer-list-FGWP_FULL"] .item-card__action > a:first-child`
		doc.Find(selector).Each(func(i int, s *goquery.Selection) {
			product := extractProductFromElement(s, "game")
			if product.TileShortName != "" {
				products = append(products, product)
			}
		})
	case "loot":
		// Look for in-game loot section
		selector := `[data-a-target="offer-list-IN_GAME_LOOT"] .item-card__action > a:first-child`
		doc.Find(selector).Each(func(i int, s *goquery.Selection) {
			product := extractProductFromElement(s, "loot")
			if product.TileShortName != "" {
				// Extract game title for loot items
				gameTitle := strings.TrimSpace(s.Find(".item-card-details__body p").First().Text())
				product.GameTitle = gameTitle
				
				// Combine game title and loot title
				if gameTitle != "" {
					product.TileShortName = fmt.Sprintf("%s - %s", gameTitle, product.TileShortName)
				}
				
				products = append(products, product)
			}
		})
	}

	// If no products found with specific selectors, try more generic approach
	if len(products) == 0 {
		log.WithField("category", category).Info("No products found with specific selectors, trying generic approach")
		
		// Try to find any cards that might be offers
		doc.Find(".item-card, [class*='card']").Each(func(i int, s *goquery.Selection) {
			text := strings.ToLower(s.Text())
			
			// Filter by category
			isRelevant := false
			if category == "games" && (strings.Contains(text, "free game") || strings.Contains(text, "claim")) {
				isRelevant = true
			} else if category == "loot" && (strings.Contains(text, "loot") || strings.Contains(text, "in-game")) {
				isRelevant = true
			}
			
			if isRelevant {
				product := extractProductFromElement(s, category)
				if product.TileShortName != "" {
					products = append(products, product)
				}
			}
		})
	}

	return products, nil
}

func extractProductFromElement(s *goquery.Selection, offerType string) Product {
	title := strings.TrimSpace(s.Find(".item-card-details__body__primary h3").Text())
	if title == "" {
		title = strings.TrimSpace(s.Find("h3").Text())
	}
	if title == "" {
		title = strings.TrimSpace(s.Find("[class*='title']").Text())
	}
	
	productURL, _ := s.Attr("href")
	imgURL, _ := s.Find(`[data-a-target="card-image"] img`).Attr("src")
	if imgURL == "" {
		imgURL, _ = s.Find("img").Attr("src")
	}
	
	// Try to find date information
	var endDate string
	dateElement := s.Find(".availability-date span:nth-child(2)")
	if dateElement.Length() > 0 {
		endDate = strings.TrimSpace(dateElement.Text())
	}

	return Product{
		TileShortName:          title,
		TileName:               title,
		ProductURL:             productURL,
		DetailedMarketingBlurb: title,
		ShortMarketingBlurb:    title,
		StartDateDatetime:      time.Now().Format(time.RFC3339),
		EndDateDatetime:        endDate,
		TileImage:              imgURL,
		Category:               offerType,
		Type:                   offerType,
	}
}

func updateCategory(wg *sync.WaitGroup, category string) {
	defer wg.Done()
	
	log.WithField("category", category).Info("Starting to scrape Prime Gaming")
	
	products, err := scrapeWithBrowser(category)
	if err != nil {
		log.WithField("step", "scraping").WithField("category", category).Error(err)
		// Create dummy product on error
		products = []Product{{
			TileShortName:          fmt.Sprintf("Scraping failed for %s", category),
			TileName:               fmt.Sprintf("Scraping failed for %s", category),
			ProductURL:             "/home",
			DetailedMarketingBlurb: fmt.Sprintf("Failed to scrape %s offers: %v", category, err),
			ShortMarketingBlurb:    fmt.Sprintf("Scraping failed for %s", category),
			StartDateDatetime:      time.Now().Format(time.RFC3339),
			EndDateDatetime:        "",
			TileImage:              "",
			Category:               category,
			Type:                   category,
		}}
	}

	log.WithField("category", category).WithField("count", len(products)).Info("Products found")

	// Create feed even if no products found, but with a dummy entry
	if len(products) == 0 {
		log.WithField("category", category).Warn("No products found, creating empty feed")
		
		dummyProduct := Product{
			TileShortName:          fmt.Sprintf("No %s offers available", category),
			TileName:               fmt.Sprintf("No %s offers available", category),
			ProductURL:             "/home",
			DetailedMarketingBlurb: fmt.Sprintf("Currently no %s offers are available on Prime Gaming.", category),
			ShortMarketingBlurb:    fmt.Sprintf("No %s offers", category),
			StartDateDatetime:      time.Now().Format(time.RFC3339),
			EndDateDatetime:        "",
			TileImage:              "",
			Category:               category,
			Type:                   category,
		}
		products = append(products, dummyProduct)
	}

	feed, err := createFeed(products, category)
	if err != nil {
		log.WithField("step", "creating").WithField("category", category).Error(err)
		return
	}

	if err := writeFeedToFile(feed, category); err != nil {
		log.WithField("step", "writing").WithField("category", category).Error(err)
		return
	}
	
	log.WithField("category", category).Info("RSS feed created successfully")
}

func writeFeedToFile(feed feeds.Feed, category string) error {
	f, err := os.OpenFile(
		fmt.Sprintf("%s.rss", category),
		os.O_CREATE|os.O_TRUNC|os.O_WRONLY,
		0644,
	)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriter(f)
	rss, err := feed.ToRss()
	if err != nil {
		return err
	}

	if _, err := w.WriteString(rss); err != nil {
		return err
	}

	w.Flush()
	return nil
}
