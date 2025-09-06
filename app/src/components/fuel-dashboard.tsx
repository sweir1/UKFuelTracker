'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, Fuel, Filter, RefreshCw, Search, X } from 'lucide-react';
import { FuelStation, FuelType } from '@/types/fuel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatPrice, formatDistance, formatDate } from '@/lib/utils';

interface PriceSummary {
  totalStations: number;
  lastUpdated: string | null;
  dataSource: string;
  priceStats: { [key: string]: { min: number; max: number; avg: number; count: number } };
  filters: {
    retailer: string | null;
    fuelType: string | null;
    postcode: string | null;
    location: { lat: number; lng: number } | null;
    maxDistance: number | null;
    priceRange: { min: number | null; max: number | null };
    sortBy: string;
    limit: number | null;
  };
}

interface StationWithRetailer extends FuelStation {
  retailer: string;
  distance?: number;
}

interface FilterState {
  fuelType: FuelType;
  postcode: string;
  retailer: string;
  maxDistance: number;
  minPrice: string;
  maxPrice: string;
  sortBy: 'distance' | 'price' | 'retailer';
  limit: number;
}

export default function FuelDashboard() {
  const [stations, setStations] = useState<StationWithRetailer[]>([]);
  const [summary, setSummary] = useState<PriceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    fuelType: 'E10',
    postcode: '',
    retailer: '',
    maxDistance: 15,
    minPrice: '',
    maxPrice: '',
    sortBy: 'distance',
    limit: 50
  });

  // Get unique retailers for filter dropdown
  const availableRetailers = useMemo(() => {
    const retailers = new Set<string>();
    stations.forEach(station => retailers.add(station.retailer));
    return Array.from(retailers).sort();
  }, [stations]);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error getting location:', error);
        setError('Unable to get your location. Please enable location services or enter a postcode.');
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  }, []);

  const fetchPrices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      
      // Add all filter parameters
      if (filters.fuelType !== 'E10') params.append('fuel_type', filters.fuelType);
      if (filters.postcode.trim()) params.append('postcode', filters.postcode.trim());
      if (filters.retailer) params.append('retailer', filters.retailer);
      if (filters.minPrice) params.append('min_price', filters.minPrice);
      if (filters.maxPrice) params.append('max_price', filters.maxPrice);
      if (filters.sortBy) params.append('sort_by', filters.sortBy);
      if (filters.limit > 0) params.append('limit', filters.limit.toString());
      
      // Add location parameters
      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
        params.append('max_distance', filters.maxDistance.toString());
      }

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
  }, [filters, userLocation]);

  // Real-time filtering with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPrices();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fetchPrices]);

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      
      // Auto-switch to distance sort when postcode is entered (and no GPS location)
      if (key === 'postcode' && typeof value === 'string' && value.trim() && !userLocation && prev.sortBy === 'price') {
        newFilters.sortBy = 'distance';
      }
      
      // Auto-switch to price sort when postcode is cleared (and no GPS location)
      if (key === 'postcode' && typeof value === 'string' && !value.trim() && !userLocation && prev.sortBy === 'distance') {
        newFilters.sortBy = 'price';
      }
      
      return newFilters;
    });
  };

  const clearFilters = () => {
    setFilters({
      fuelType: 'E10',
      postcode: '',
      retailer: '',
      maxDistance: 15,
      minPrice: '',
      maxPrice: '',
      sortBy: userLocation ? 'distance' : 'price',
      limit: 50
    });
  };

  const clearLocation = () => {
    setUserLocation(null);
    setFilters(prev => ({ ...prev, sortBy: 'price' }));
  };

  const getRankBadgeVariant = (index: number) => {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return 'outline';
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="flex items-center gap-3 mb-2">
            <Fuel className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">UK Fuel Price Tracker</h1>
          </div>
          <p className="text-muted-foreground">
            Live fuel prices from major UK retailers. Data sourced from the CMA temporary pricing scheme.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-8">
        {/* Filters Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <CardTitle>Search & Filters</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {Object.values(filters).some(v => v !== '' && v !== 'E10' && v !== 25 && v !== 50 && v !== 'distance') && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={fetchPrices} disabled={loading}>
                  <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Location Controls */}
            <div className="flex flex-wrap items-center gap-4">
              {!userLocation ? (
                <Button
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <MapPin className={cn("h-4 w-4", locationLoading && "animate-pulse")} />
                  {locationLoading ? 'Getting Location...' : 'Use My Location'}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Location Enabled
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={clearLocation}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              {(userLocation || filters.postcode.trim()) && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Max Distance:</label>
                  <Select
                    value={filters.maxDistance.toString()}
                    onChange={(e) => updateFilter('maxDistance', parseInt(e.target.value))}
                    className="w-24"
                  >
                    <option value="3">3 miles</option>
                    <option value="5">5 miles</option>
                    <option value="10">10 miles</option>
                    <option value="15">15 miles</option>
                    <option value="25">25 miles</option>
                    <option value="50">50 miles</option>
                  </Select>
                </div>
              )}
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fuel Type</label>
                <Select
                  value={filters.fuelType}
                  onChange={(e) => updateFilter('fuelType', e.target.value as FuelType)}
                >
                  <option value="E10">E10 (Regular Petrol)</option>
                  <option value="E5">E5 (Premium Petrol)</option>
                  <option value="B7">B7 (Diesel)</option>
                  <option value="SDV">SDV (Super Diesel)</option>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Postcode</label>
                <Input
                  value={filters.postcode}
                  onChange={(e) => updateFilter('postcode', e.target.value)}
                  placeholder="e.g. SW1A"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Retailer</label>
                <Select
                  value={filters.retailer}
                  onChange={(e) => updateFilter('retailer', e.target.value)}
                >
                  <option value="">All Retailers</option>
                  {availableRetailers.map(retailer => (
                    <option key={retailer} value={retailer}>{retailer}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                >
                  {(userLocation || filters.postcode.trim()) && <option value="distance">Distance</option>}
                  <option value="price">Price</option>
                  <option value="retailer">Retailer</option>
                </Select>
              </div>
            </div>

            {/* Price Range & Limit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Price (pence)</label>
                <Input
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => updateFilter('minPrice', e.target.value)}
                  placeholder="e.g. 120"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Max Price (pence)</label>
                <Input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => updateFilter('maxPrice', e.target.value)}
                  placeholder="e.g. 160"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Results Limit</label>
                <Select
                  value={filters.limit.toString()}
                  onChange={(e) => updateFilter('limit', parseInt(e.target.value))}
                >
                  <option value="20">20 results</option>
                  <option value="50">50 results</option>
                  <option value="100">100 results</option>
                  <option value="0">Show all</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">{summary.totalStations.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Stations</div>
              </CardContent>
            </Card>
            
            {summary.priceStats && summary.priceStats[filters.fuelType] && (
              <>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-success">
                      {formatPrice(summary.priceStats[filters.fuelType].min)}
                    </div>
                    <div className="text-sm text-muted-foreground">Cheapest {filters.fuelType}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-error">
                      {formatPrice(summary.priceStats[filters.fuelType].max)}
                    </div>
                    <div className="text-sm text-muted-foreground">Most Expensive</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-foreground">
                      {formatPrice(summary.priceStats[filters.fuelType].avg)}
                    </div>
                    <div className="text-sm text-muted-foreground">Average Price</div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Status Messages */}
        {userLocation && (
          <Card className="border-success/20 bg-success/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-success text-sm">
                <MapPin className="h-4 w-4" />
                Showing {filters.fuelType} stations within {filters.maxDistance} miles of your location
              </div>
            </CardContent>
          </Card>
        )}

        {!userLocation && filters.postcode.trim() && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-primary text-sm">
                <MapPin className="h-4 w-4" />
                Showing {filters.fuelType} stations within {filters.maxDistance} miles of {filters.postcode.toUpperCase()}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-error/20 bg-error/5">
            <CardContent className="p-4">
              <div className="text-error text-sm">Error: {error}</div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Fuel Stations</CardTitle>
              {summary?.lastUpdated && (
                <CardDescription>
                  Last updated: {formatDate(summary.lastUpdated)}
                </CardDescription>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : stations.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="pb-3 text-sm font-medium text-muted-foreground">Rank</th>
                        <th className="pb-3 text-sm font-medium text-muted-foreground">Station</th>
                        <th className="pb-3 text-sm font-medium text-muted-foreground">Location</th>
                        {userLocation && (
                          <th className="pb-3 text-sm font-medium text-muted-foreground text-center">Distance</th>
                        )}
                        <th className="pb-3 text-sm font-medium text-muted-foreground text-right">{filters.fuelType} Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stations.map((station, index) => (
                        <tr key={`${station.site_id}-${station.retailer}`} className="hover:bg-muted/50">
                          <td className="py-4">
                            <Badge variant={getRankBadgeVariant(index)} className="w-8 h-8 rounded-full flex items-center justify-center">
                              {index + 1}
                            </Badge>
                          </td>
                          <td className="py-4">
                            <div>
                              <div className="font-medium">{station.brand}</div>
                              <div className="text-sm text-muted-foreground">{station.retailer}</div>
                            </div>
                          </td>
                          <td className="py-4">
                            <div>
                              <div className="text-sm">{station.address}</div>
                              <div className="text-sm text-muted-foreground">{station.postcode}</div>
                            </div>
                          </td>
                          {userLocation && (
                            <td className="py-4 text-center text-sm text-muted-foreground">
                              {formatDistance(station.distance)}
                            </td>
                          )}
                          <td className="py-4 text-right">
                            <span className={cn(
                              "text-lg font-semibold",
                              index === 0 ? "text-success" : "text-foreground"
                            )}>
                              {formatPrice(station.prices[filters.fuelType])}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {stations.map((station, index) => (
                    <Card key={`${station.site_id}-${station.retailer}`} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge variant={getRankBadgeVariant(index)} className="w-8 h-8 rounded-full flex items-center justify-center text-xs">
                              {index + 1}
                            </Badge>
                            <div>
                              <div className="font-medium">{station.brand}</div>
                              <div className="text-sm text-muted-foreground">{station.retailer}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn(
                              "text-lg font-semibold",
                              index === 0 ? "text-success" : "text-foreground"
                            )}>
                              {formatPrice(station.prices[filters.fuelType])}
                            </div>
                            <div className="text-xs text-muted-foreground">{filters.fuelType}</div>
                          </div>
                        </div>
                        
                        <div className="text-sm text-muted-foreground mb-2">
                          {station.address}
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-muted-foreground">{station.postcode}</div>
                          {userLocation && station.distance && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {formatDistance(station.distance)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <div className="text-muted-foreground">
                  {userLocation 
                    ? `No ${filters.fuelType} stations found within ${filters.maxDistance} miles of your location.`
                    : filters.postcode.trim()
                    ? `No ${filters.fuelType} stations found within ${filters.maxDistance} miles of ${filters.postcode.toUpperCase()}.`
                    : "No stations found matching your criteria."
                  }
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Try adjusting your filters or {userLocation ? "increasing the distance" : "enabling location services"}.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}