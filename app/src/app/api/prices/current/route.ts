import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { FuelData, FuelStation, StationWithRetailerAndDistance } from '@/types/fuel';
import { GitHubStorage } from '@/lib/github-storage';

// Haversine formula to calculate distance between two points in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const retailer = searchParams.get('retailer');
  const fuelType = searchParams.get('fuel_type');
  const postcode = searchParams.get('postcode');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const maxDistance = searchParams.get('max_distance');
  const minPrice = searchParams.get('min_price');
  const maxPrice = searchParams.get('max_price');
  const sortBy = searchParams.get('sort_by') || 'distance';
  const limit = parseInt(searchParams.get('limit') || '0');
  
  // Store postcode location for summary
  let postcodeLocation: { lat: number; lng: number } | null = null;
  
  try {
    const currentDataPath = path.join(process.cwd(), 'data', 'current');
    
    // Try to read from local files first, fallback to GitHub
    const allStations: FuelStation[] = [];
    let lastUpdated: string | null = null;
    let dataSource = 'local';

    try {
      await fs.access(currentDataPath);
    } catch {
      // Local data not available, try GitHub
      try {
        const storage = new GitHubStorage();
        const githubData = await storage.getCurrentData(retailer || undefined);
        
        for (const [retailerName, data] of Object.entries(githubData)) {
          if (data.last_updated) {
            if (!lastUpdated || new Date(data.last_updated) > new Date(lastUpdated)) {
              lastUpdated = data.last_updated;
            }
          }

          const stationsWithRetailer = data.stations.map(station => ({
            ...station,
            retailer: retailerName
          }));

          allStations.push(...stationsWithRetailer);
        }

        dataSource = 'github';
      } catch (error) {
        console.error('Failed to fetch from GitHub:', error);
        return NextResponse.json({
          message: 'No current price data available',
          stations: [],
          summary: { totalStations: 0, lastUpdated: null },
          error: 'Both local and GitHub data sources unavailable'
        });
      }
    }

    // Only try to read local files if we didn't already get data from GitHub
    if (dataSource === 'local') {
      const files = await fs.readdir(currentDataPath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        // Try GitHub as fallback
        try {
          const storage = new GitHubStorage();
          const githubData = await storage.getCurrentData(retailer || undefined);
          
          for (const [retailerName, data] of Object.entries(githubData)) {
            if (data.last_updated) {
              if (!lastUpdated || new Date(data.last_updated) > new Date(lastUpdated)) {
                lastUpdated = data.last_updated;
              }
            }

            const stationsWithRetailer = data.stations.map(station => ({
              ...station,
              retailer: retailerName
            }));

            allStations.push(...stationsWithRetailer);
          }

          dataSource = 'github';
        } catch {
          return NextResponse.json({
            message: 'No current price data available',
            stations: [],
            summary: { totalStations: 0, lastUpdated: null }
          });
        }
      } else {
        // Load data from local files
        for (const file of jsonFiles) {
          const retailerName = path.basename(file, '.json');
          
          // Filter by retailer if specified
          if (retailer && !retailerName.toLowerCase().includes(retailer.toLowerCase())) {
            continue;
          }

          try {
            const filePath = path.join(currentDataPath, file);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const data: FuelData = JSON.parse(fileContent);
            
            if (data.last_updated) {
              if (!lastUpdated || new Date(data.last_updated) > new Date(lastUpdated)) {
                lastUpdated = data.last_updated;
              }
            }

            // Add retailer info to each station
            const stationsWithRetailer = data.stations.map(station => ({
              ...station,
              retailer: retailerName
            }));

            allStations.push(...stationsWithRetailer);
          } catch (error) {
            console.error(`Error reading ${file}:`, error);
            continue;
          }
        }
      }
    }

    // Apply filters
    let filteredStations = allStations;

    // Filter by fuel type
    if (fuelType) {
      filteredStations = filteredStations.filter(station => 
        station.prices[fuelType] !== undefined && station.prices[fuelType] > 0
      );
    }

    // Convert postcode to coordinates for distance-based search
    if (postcode && !lat && !lng) {
      console.log(`🏷️  Postcode search: converting "${postcode}" to coordinates...`);
      try {
        // Use free UK postcode API
        const postcodeResponse = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
        const postcodeData = await postcodeResponse.json();
        
        if (postcodeData.status === 200 && postcodeData.result) {
          postcodeLocation = {
            lat: postcodeData.result.latitude,
            lng: postcodeData.result.longitude
          };
          
          console.log(`📍 Postcode coordinates: ${postcodeLocation.lat}, ${postcodeLocation.lng}`);
          
          // Apply distance-based filtering using postcode coordinates
          const maxDist = maxDistance ? parseFloat(maxDistance) : 15; // Default 15 miles
          console.log(`🌍 Postcode filter: searching within ${maxDist} miles of ${postcode}`);
          console.log(`📍 Total stations before distance filter: ${filteredStations.length}`);
          
          filteredStations = filteredStations
            .filter(station => {
              // Check if station has valid coordinates
              const hasValidCoords = station.location && 
                                   station.location.latitude && station.location.longitude && 
                                   !isNaN(station.location.latitude) && !isNaN(station.location.longitude) &&
                                   station.location.latitude !== 0 && station.location.longitude !== 0;
              return hasValidCoords;
            })
            .map(station => ({
              ...station,
              distance: calculateDistance(postcodeLocation!.lat, postcodeLocation!.lng, station.location.latitude, station.location.longitude)
            }))
            .filter(station => {
              const withinRange = station.distance <= maxDist;
              return withinRange;
            });
          
          console.log(`📍 Stations within ${maxDist} miles of ${postcode}: ${filteredStations.length}`);
          if (filteredStations.length > 0) {
            console.log(`✅ Closest station: ${filteredStations[0].brand} at ${(filteredStations[0] as StationWithRetailerAndDistance).distance?.toFixed(1)} miles`);
          }
          
          // postcodeLocation is now stored in the variable declared at the top
          
        } else {
          console.log(`❌ Invalid postcode: ${postcode}`);
          // Fallback to original prefix matching for invalid postcodes
          filteredStations = filteredStations.filter(station =>
            station.postcode.toLowerCase().replace(/\s+/g, '').startsWith(postcode.toLowerCase().replace(/\s+/g, ''))
          );
        }
        
      } catch (error) {
        console.error(`❌ Error geocoding postcode ${postcode}:`, error);
        // Fallback to original prefix matching on error
        filteredStations = filteredStations.filter(station =>
          station.postcode.toLowerCase().replace(/\s+/g, '').startsWith(postcode.toLowerCase().replace(/\s+/g, ''))
        );
      }
    }

    // Filter by location and distance
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const maxDist = maxDistance ? parseFloat(maxDistance) : 30; // Default 30 mile radius
      
      console.log(`🌍 Location filter: userLat=${userLat}, userLng=${userLng}, maxDist=${maxDist} miles`);
      console.log(`📍 Total stations before location filter: ${filteredStations.length}`);
      
      // Add distance to each station and filter by max distance
      filteredStations = filteredStations
        .filter(station => {
          // Check if station has valid coordinates (not null, undefined, 0, or NaN)
          const hasValidCoords = station.location && 
                               station.location.latitude && station.location.longitude && 
                               !isNaN(station.location.latitude) && !isNaN(station.location.longitude) &&
                               station.location.latitude !== 0 && station.location.longitude !== 0;
          if (!hasValidCoords) {
            console.log(`⚠️  Station ${station.brand} at ${station.postcode} has invalid coordinates: lat=${station.location?.latitude}, lng=${station.location?.longitude}`);
          }
          return hasValidCoords;
        })
        .map(station => ({
          ...station,
          distance: calculateDistance(userLat, userLng, station.location.latitude, station.location.longitude)
        }))
        .filter(station => {
          const withinRange = station.distance <= maxDist;
          if (!withinRange && station.distance < maxDist * 2) { // Only log if reasonably close
            console.log(`❌ Station ${station.brand} at ${station.postcode} is ${station.distance.toFixed(1)} miles away (> ${maxDist} miles)`);
          }
          return withinRange;
        });
        
      console.log(`📍 Stations after location filter: ${filteredStations.length}`);
      if (filteredStations.length > 0) {
        console.log(`✅ Closest station: ${filteredStations[0].brand} at ${(filteredStations[0] as StationWithRetailerAndDistance).distance?.toFixed(1)} miles`);
      }
    }

    // Filter by price range
    if (fuelType && (minPrice || maxPrice)) {
      const min = minPrice ? parseFloat(minPrice) : 0;
      const max = maxPrice ? parseFloat(maxPrice) : Infinity;
      
      filteredStations = filteredStations.filter(station => {
        const price = station.prices[fuelType];
        return price !== undefined && price >= min && price <= max;
      });
    }

    // Sort results
    if (((lat && lng) || postcodeLocation) && sortBy === 'distance') {
      filteredStations.sort((a, b) => ((a as StationWithRetailerAndDistance).distance || 0) - ((b as StationWithRetailerAndDistance).distance || 0));
    } else if (fuelType && sortBy === 'price') {
      filteredStations.sort((a, b) => (a.prices[fuelType] || 0) - (b.prices[fuelType] || 0));
    } else if (sortBy === 'retailer') {
      filteredStations.sort((a, b) => (a as StationWithRetailerAndDistance).retailer.localeCompare((b as StationWithRetailerAndDistance).retailer));
    }

    // Limit results if specified
    if (limit > 0) {
      filteredStations = filteredStations.slice(0, limit);
    }

    // Calculate summary statistics
    const fuelTypes = ['E10', 'E5', 'B7', 'SDV'];
    const priceStats: { [key: string]: { min: number; max: number; avg: number; count: number } } = {};

    fuelTypes.forEach(fuel => {
      const prices = filteredStations
        .map(s => s.prices[fuel])
        .filter(price => price !== undefined && price > 0);
      
      if (prices.length > 0) {
        priceStats[fuel] = {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: Math.round((prices.reduce((sum, p) => sum + p, 0) / prices.length) * 10) / 10,
          count: prices.length
        };
      }
    });

    return NextResponse.json({
      stations: filteredStations,
      summary: {
        totalStations: filteredStations.length,
        lastUpdated: lastUpdated,
        dataSource: dataSource,
        priceStats: priceStats,
        filters: {
          retailer: retailer || null,
          fuelType: fuelType || null,
          postcode: postcode || null,
          location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : postcodeLocation,
          maxDistance: maxDistance ? parseFloat(maxDistance) : null,
          priceRange: {
            min: minPrice ? parseFloat(minPrice) : null,
            max: maxPrice ? parseFloat(maxPrice) : null
          },
          sortBy: sortBy,
          limit: limit > 0 ? limit : null
        }
      }
    });

  } catch (error) {
    console.error('Error fetching current prices:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch current prices',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}