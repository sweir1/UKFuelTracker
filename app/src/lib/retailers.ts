import { RetailerConfig } from '@/types/fuel';

export const RETAILERS: RetailerConfig[] = [
  {
    name: 'Ascona Group',
    url: 'https://fuelprices.asconagroup.co.uk/newfuel.json',
    enabled: true
  },
  {
    name: 'Asda',
    url: 'https://storelocator.asda.com/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'BP',
    url: 'https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'Esso Tesco Alliance',
    url: 'https://fuelprices.esso.co.uk/latestdata.json',
    enabled: true
  },
  {
    name: 'JET Retail UK',
    url: 'https://jetlocal.co.uk/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'Karan Retail Ltd',
    url: 'https://api.krl.live/integration/live_price/krl',
    enabled: true
  },
  {
    name: 'Morrisons',
    url: 'https://www.morrisons.com/fuel-prices/fuel.json',
    enabled: true
  },
  {
    name: 'Moto',
    url: 'https://moto-way.com/fuel-price/fuel_prices.json',
    enabled: true
  },
  {
    name: 'Motor Fuel Group',
    url: 'https://fuel.motorfuelgroup.com/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'Rontec',
    url: 'https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'Sainsburys',
    url: 'https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'SGN',
    url: 'https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json',
    enabled: true
  },
  {
    name: 'Shell',
    url: 'https://www.shell.co.uk/fuel-prices-data.html',
    enabled: false // HTML format, needs special handling
  },
  {
    name: 'Tesco',
    url: 'https://www.tesco.com/fuel_prices/fuel_prices_data.json',
    enabled: true
  }
];