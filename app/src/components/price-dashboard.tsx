'use client';

import { useState, useEffect, useCallback } from 'react';
import { FuelStation, FuelType } from '@/types/fuel';

interface PriceSummary {
  totalStations: number;
  lastUpdated: string | null;
  dataSource: string;
  priceStats: { [key: string]: { min: number; max: number; avg: number; count: number } };
}

export default function PriceDashboard() {
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [summary, setSummary] = useState<PriceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('E10');
  const [searchPostcode, setSearchPostcode] = useState('');

  const fetchPrices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (selectedFuel !== 'E10') params.append('fuel_type', selectedFuel);
      if (searchPostcode.trim()) params.append('postcode', searchPostcode.trim());

      const response = await fetch(`/api/prices/current?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch prices');
      }

      setStations(data.stations || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStations([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedFuel, searchPostcode]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPrices();
  };

  const formatPrice = (price: number) => {
    return `${price.toFixed(1)}p`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">UK Fuel Price Tracker</h1>
        <p className="text-gray-600 mb-6">
          Live fuel prices from major UK retailers. Data sourced from the CMA temporary pricing scheme.
        </p>
        
        {/* Search Controls */}
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex flex-col">
            <label htmlFor="fuel-type" className="text-sm font-medium mb-1">Fuel Type</label>
            <select
              id="fuel-type"
              value={selectedFuel}
              onChange={(e) => setSelectedFuel(e.target.value as FuelType)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="E10">E10 (Regular Petrol)</option>
              <option value="E5">E5 (Premium Petrol)</option>
              <option value="B7">B7 (Diesel)</option>
              <option value="SDV">SDV (Super Diesel)</option>
            </select>
          </div>
          
          <div className="flex flex-col">
            <label htmlFor="postcode" className="text-sm font-medium mb-1">Postcode (optional)</label>
            <input
              id="postcode"
              type="text"
              value={searchPostcode}
              onChange={(e) => setSearchPostcode(e.target.value)}
              placeholder="e.g. SW1A"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={fetchPrices}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </form>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-700">Total Stations</h3>
              <p className="text-2xl font-bold text-blue-600">{summary.totalStations.toLocaleString()}</p>
            </div>
            
            {summary.priceStats && summary.priceStats[selectedFuel] && (
              <>
                <div className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="text-lg font-semibold text-gray-700">Cheapest {selectedFuel}</h3>
                  <p className="text-2xl font-bold text-green-600">
                    {formatPrice(summary.priceStats[selectedFuel].min)}
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="text-lg font-semibold text-gray-700">Most Expensive</h3>
                  <p className="text-2xl font-bold text-red-600">
                    {formatPrice(summary.priceStats[selectedFuel].max)}
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="text-lg font-semibold text-gray-700">Average Price</h3>
                  <p className="text-2xl font-bold text-gray-700">
                    {formatPrice(summary.priceStats[selectedFuel].avg)}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Data Info */}
        {summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {summary.lastUpdated && (
                <span className="text-blue-700">
                  Last updated: {formatDate(summary.lastUpdated)}
                </span>
              )}
              <span className="text-blue-600">
                Data source: {summary.dataSource === 'github' ? 'GitHub Storage' : 'Local Files'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">Error: {error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading fuel prices...</span>
        </div>
      )}

      {/* Results Table */}
      {!loading && stations.length > 0 && (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">
              {selectedFuel} Prices
              {searchPostcode && ` near ${searchPostcode.toUpperCase()}`}
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Retailer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Postcode
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {selectedFuel} Price
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stations
                  .filter(station => station.prices[selectedFuel] && station.prices[selectedFuel] > 0)
                  .sort((a, b) => a.prices[selectedFuel] - b.prices[selectedFuel])
                  .slice(0, 100) // Limit to first 100 results
                  .map((station) => (
                    <tr key={`${station.site_id}-${station.retailer}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{station.brand}</div>
                        <div className="text-xs text-gray-500">{station.retailer}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{station.address}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {station.postcode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-lg font-semibold text-gray-900">
                          {formatPrice(station.prices[selectedFuel])}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && stations.length === 0 && !error && (
        <div className="text-center p-8">
          <p className="text-gray-600">No fuel stations found with the current filters.</p>
        </div>
      )}
    </div>
  );
}