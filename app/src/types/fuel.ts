export interface FuelStation {
  site_id: string;
  brand: string;
  address: string;
  postcode: string;
  location: {
    latitude: number;
    longitude: number;
  };
  prices: {
    [key: string]: number; // E10, E5, B7, SDV, etc.
  };
}

export interface StationWithRetailerAndDistance extends FuelStation {
  retailer: string;
  distance?: number;
}

export interface FuelData {
  last_updated: string;
  stations: FuelStation[];
}

export interface RetailerConfig {
  name: string;
  url: string;
  enabled: boolean;
}

export interface PriceHistory {
  date: string;
  retailer: string;
  site_id: string;
  fuel_type: string;
  price: number;
}

export interface PriceTrend {
  fuel_type: string;
  current_avg: number;
  previous_avg: number;
  change: number;
  change_percent: number;
}

export type FuelType = 'E10' | 'E5' | 'B7' | 'SDV';