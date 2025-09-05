'use client';

import { useState, useEffect } from 'react';
import { FuelStation, FuelType } from '@/types/fuel';

interface CheapestStation extends FuelStation {
  retailer: string;
  distance?: number;
}

export default function CheapestStations() {
  const [stations, setStations] = useState<CheapestStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('E10');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [maxDistance, setMaxDistance] = useState(25);
  const [limit, setLimit] = useState(20);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          setError('Unable to get your location. Please enable location services.');
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  };

  const fetchCheapestStations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        fuel: selectedFuel,
        limit: limit.toString()
      });

      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
        params.append('max_distance', maxDistance.toString());
      }

      const response = await fetch(`/api/stations/cheapest?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch cheapest stations');
      }

      setStations(data.stations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLocation) {
      fetchCheapestStations();
    }
  }, [userLocation, selectedFuel, maxDistance, limit]);

  const formatPrice = (price: number) => {
    return `${price.toFixed(1)}p`;
  };

  const formatDistance = (distance?: number) => {
    if (!distance) return 'Unknown';
    return `${distance.toFixed(1)} km`;
  };

  return (
    <div className="bg-white rounded-lg shadow border p-6">
      <h2 className="text-2xl font-bold mb-6">Find Cheapest Fuel Stations</h2>
      
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-col">
          <label htmlFor="fuel-select" className="text-sm font-medium mb-1">Fuel Type</label>
          <select
            id="fuel-select"
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

        {userLocation && (
          <>
            <div className="flex flex-col">
              <label htmlFor="distance" className="text-sm font-medium mb-1">Max Distance (km)</label>
              <input
                id="distance"
                type="number"
                min="1"
                max="100"
                value={maxDistance}
                onChange={(e) => setMaxDistance(parseInt(e.target.value) || 25)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="limit" className="text-sm font-medium mb-1">Number of Results</label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10 stations</option>
                <option value={20}>20 stations</option>
                <option value={50}>50 stations</option>
              </select>
            </div>
          </>
        )}

        <div className="flex flex-col justify-end">
          {!userLocation ? (
            <button
              onClick={getCurrentLocation}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Get My Location
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={fetchCheapestStations}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Refresh'}
              </button>
              <button
                onClick={() => {
                  setUserLocation(null);
                  fetchCheapestStations();
                }}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Show All UK
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Location Status */}
      {userLocation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-700 text-sm">
            📍 Showing cheapest {selectedFuel} stations within {maxDistance}km of your location
          </p>
        </div>
      )}

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
          <span className="ml-2 text-gray-600">Finding cheapest stations...</span>
        </div>
      )}

      {/* Results */}
      {!loading && stations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retailer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Postcode
                </th>
                {userLocation && (
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distance
                  </th>
                )}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {selectedFuel} Price
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stations.map((station, index) => (
                <tr key={`${station.site_id}-${station.retailer}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-800' :
                      index === 2 ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
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
                  {userLocation && (
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {formatDistance(station.distance)}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`text-lg font-semibold ${
                      index === 0 ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {formatPrice(station.prices[selectedFuel])}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No Results */}
      {!loading && stations.length === 0 && !error && userLocation && (
        <div className="text-center p-8">
          <p className="text-gray-600">
            No {selectedFuel} stations found within {maxDistance}km of your location.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Try increasing the distance or selecting a different fuel type.
          </p>
        </div>
      )}

      {!loading && stations.length === 0 && !error && !userLocation && (
        <div className="text-center p-8">
          <p className="text-gray-600">
            Click "Get My Location" to find the cheapest fuel stations near you,
            or the data might still be loading.
          </p>
        </div>
      )}
    </div>
  );
}