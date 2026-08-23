export type RecommendationInput = {
  goals: string;
  party: number;
  sailingSlug?: string | undefined;
  portSlug?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

export type Recommendation = {
  reason: string;
  excursionTitle: string;
  excursionSlug: string;
  portName: string;
  sailingName: string;
  sailingSlug: string;
  date: string;
  arrivalTime: string | null;
  departureTime: string | null;
  durationMinutes: number;
  price: number;
  currency: string;
  imageUrl: string | null;
  seatsLeft: number;
  bookHref: string;
};

export type RecommendationResult = {
  intro: string;
  suggestions: Recommendation[];
};
