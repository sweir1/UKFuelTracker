import FuelDashboard from '@/components/fuel-dashboard';

export default function Home() {
  return (
    <>
      <FuelDashboard />
      
      <footer className="bg-card border-t">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              UK Fuel Price Tracker - Data sourced from the{' '}
              <a 
                href="https://www.gov.uk/guidance/petrol-station-price-information-regulations" 
                className="text-primary hover:text-primary/80 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                CMA temporary pricing scheme
              </a>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Prices may have a delay. Always check prices at the forecourt before purchasing.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}