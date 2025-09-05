import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { FuelData, FuelStation, FuelType } from '@/types/fuel';

interface CheapestStation extends FuelStation {
  retailer: string;
  distance?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fuelType = searchParams.get('fuel') as FuelType || 'E10';
  const limit = parseInt(searchParams.get('limit') || '10');
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const maxDistance = parseInt(searchParams.get('max_distance') || '50'); // km

  try {
    const currentDataPath = path.join(process.cwd(), 'data', 'current');
    
    try {
      await fs.access(currentDataPath);
    } catch {
      return NextResponse.json({
        message: 'No current price data available',
        stations: []
      });
    }

    const files = await fs.readdir(currentDataPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      return NextResponse.json({
        message: 'No current price data available',
        stations: []
      });
    }

    let allStations: CheapestStation[] = [];

    // Load and combine data from all retailers
    for (const file of jsonFiles) {
      const retailerName = path.basename(file, '.json');
      
      try {
        const filePath = path.join(currentDataPath, file);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const data: FuelData = JSON.parse(fileContent);
        
        const stationsWithRetailer: CheapestStation[] = data.stations.map(station => ({
          ...station,
          retailer: retailerName
        }));

        allStations.push(...stationsWithRetailer);
      } catch (error) {
        console.error(`Error reading ${file}:`, error);
        continue;
      }
    }

    // Filter stations that have the requested fuel type
    const stationsWithFuel = allStations.filter(station => 
      station.prices[fuelType] !== undefined && 
      station.prices[fuelType] > 0
    );

    // Calculate distances if lat/lng provided
    if (lat !== 0 && lng !== 0) {
      stationsWithFuel.forEach(station => {
        const distance = calculateDistance(
          lat, lng,
          station.location.latitude,
          station.location.longitude
        );
        station.distance = Math.round(distance * 10) / 10; // Round to 1 decimal
      });

      // Filter by maximum distance
      const nearbyStations = stationsWithFuel.filter(station => 
        !station.distance || station.distance <= maxDistance
      );

      // Sort by price, then by distance
      nearbyStations.sort((a, b) => {
        const priceDiff = a.prices[fuelType] - b.prices[fuelType];
        if (priceDiff !== 0) return priceDiff;
        return (a.distance || Infinity) - (b.distance || Infinity);
      });

      const limitedStations = nearbyStations.slice(0, limit);

      return NextResponse.json({
        fuelType,
        location: { lat, lng },
        maxDistance,
        stations: limitedStations,
        summary: {
          totalFound: nearbyStations.length,
          cheapestPrice: limitedStations[0]?.prices[fuelType] || null,
          avgPrice: limitedStations.length > 0 
            ? Math.round((limitedStations.reduce((sum, s) => sum + s.prices[fuelType], 0) / limitedStations.length) * 10) / 10
            : null
        }
      });
    } else {
      // Sort by price only
      stationsWithFuel.sort((a, b) => a.prices[fuelType] - b.prices[fuelType]);
      const limitedStations = stationsWithFuel.slice(0, limit);

      return NextResponse.json({
        fuelType,
        stations: limitedStations,
        summary: {
          totalFound: stationsWithFuel.length,
          cheapestPrice: limitedStations[0]?.prices[fuelType] || null,
          avgPrice: limitedStations.length > 0 
            ? Math.round((limitedStations.reduce((sum, s) => sum + s.prices[fuelType], 0) / limitedStations.length) * 10) / 10
            : null
        }
      });
    }

  } catch (error) {
    console.error('Error finding cheapest stations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to find cheapest stations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}