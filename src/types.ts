export enum OfferSource {
  AMAZON = "AMAZON"
}

export enum OfferDuration {
  CLAIMABLE = "CLAIMABLE"
}

export enum OfferPlatform {
  PC = "PC"
}

export enum OfferType {
  GAME = "GAME"
}

export interface NewOffer {
  source: OfferSource;
  duration: OfferDuration;
  type: OfferType;
  platform: OfferPlatform;
  title: string;
  probable_game_name: string;
  seen_last: string;
  seen_first: string;
  valid_to: string | null;
  rawtext: string;
  url: string;
  img_url: string;
}

export interface AmazonBaseOffer {
  title: string;
  url: string;
  imgUrl: string;
  validTo?: string;
}
