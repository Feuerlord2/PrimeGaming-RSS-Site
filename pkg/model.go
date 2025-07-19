package goprimegaming

// Product represents a generic Prime Gaming offer (game or loot)
type Product struct {
	TileShortName          string  `json:"tile_short_name"`
	ProductURL             string  `json:"product_url"`
	DetailedMarketingBlurb string  `json:"detailed_marketing_blurb"`
	ShortMarketingBlurb    string  `json:"short_marketing_blurb"`
	StartDateDatetime      string  `json:"start_date|datetime"`
	EndDateDatetime        string  `json:"end_date|datetime"`
	TileImage              string  `json:"tile_image"`
	TileName               string  `json:"tile_name"`
	Category               string  `json:"category"`
	Type                   string  `json:"type"`
	GameTitle              string  `json:"game_title,omitempty"` // For loot items
}
