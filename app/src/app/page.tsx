import PriceDashboard from '@/components/price-dashboard';
import CheapestStations from '@/components/cheapest-stations';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8">
        <PriceDashboard />
      </div>
      
      <div className="py-8 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <CheapestStations />
        </div>
      </div>

      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center">
            <p className="text-sm text-gray-300">
              UK Fuel Price Tracker - Data sourced from the{' '}
              <a 
                href="https://www.gov.uk/guidance/petrol-station-price-information-regulations" 
                className="text-blue-300 hover:text-blue-200 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                CMA temporary pricing scheme
              </a>
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Prices may have a delay. Always check prices at the forecourt before purchasing.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}