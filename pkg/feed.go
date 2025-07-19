package goprimegaming

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
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
		// Parse the start date
		var dt time.Time
		var err error
		if product.StartDateDatetime != "" {
			// Try parsing different date formats
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

	// Sort items so that latest offers are on the top
	sort.Slice(feed.Items, func(i, j int) bool { 
		return feed.Items[i].Created.After(feed.Items[j].Created) 
	})

	return feed, nil
}

func updateCategory(wg *sync.WaitGroup, category string) {
	defer wg.Done()
	
	resp, err := http.Get("https://gaming.amazon.com/home")
	if err != nil {
		log.WithField("category", category).Error(err)
		return
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		log.WithField("category", category).Error(err)
		return
	}

	// Log some debug info about the page content
	log.WithField("category", category).Info("Scraping Prime Gaming page")
	
	products, err := parseProducts(doc, category)
	if err != nil {
		log.WithField("step", "parsing").WithField("category", category).Error(err)
		return
	}

	log.WithField("category", category).WithField("count", len(products)).Info("Products found")

	// Create feed even if no products found, but with a dummy entry
	if len(products) == 0 {
		log.WithField("category", category).Warn("No products found, creating empty feed")
		
		// Create a dummy product so we have something in the feed
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



func updateCategory(wg *sync.WaitGroup, category string) {
	defer wg.Done()
	
	resp, err := http.Get("https://gaming.amazon.com/home")
	if err != nil {
		log.WithField("category", category).Error(err)
		return
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		log.WithField("category", category).Error(err)
		return
	}

	// Log some debug info about the page content
	log.WithField("category", category).Info("Scraping Prime Gaming page")
	
	products, err := parseProducts(doc, category)
	if err != nil {
		log.WithField("step", "parsing").WithField("category", category).Error(err)
		return
	}

	log.WithField("category", category).WithField("count", len(products)).Info("Products found")

	// Create feed even if no products found, but with a dummy entry
	if len(products) == 0 {
		log.WithField("category", category).Warn("No products found, creating empty feed")
		
		// Create a dummy product so we have something in the feed
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

	// Manual flush because otherwise the RSS feeds will not be created all the time
	w.Flush()
	return nil
}
