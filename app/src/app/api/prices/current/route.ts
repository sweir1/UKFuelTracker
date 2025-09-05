import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { FuelData, FuelStation } from '@/types/fuel';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const retailer = searchParams.get('retailer');
  const fuelType = searchParams.get('fuel_type');
  const postcode = searchParams.get('postcode');
  
  try {
    const currentDataPath = path.join(process.cwd(), 'data', 'current');
    
    // Check if directory exists
    try {
      await fs.access(currentDataPath);
    } catch {
      return NextResponse.json({
        message: 'No current price data available',
        stations: [],
        summary: { totalStations: 0, lastUpdated: null }
      });
    }

    const files = await fs.readdir(currentDataPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      return NextResponse.json({
        message: 'No current price data available',
        stations: [],
        summary: { totalStations: 0, lastUpdated: null }
      });
    }

    let allStations: FuelStation[] = [];
    let lastUpdated: string | null = null;

    // Load data from all retailers
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

    // Apply filters
    let filteredStations = allStations;

    // Filter by fuel type
    if (fuelType) {
      filteredStations = filteredStations.filter(station => 
        station.prices[fuelType] !== undefined && station.prices[fuelType] > 0
      );
    }

    // Filter by postcode (simple prefix match)
    if (postcode) {
      filteredStations = filteredStations.filter(station =>
        station.postcode.toLowerCase().startsWith(postcode.toLowerCase().replace(/\s+/g, ''))
      );
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
        priceStats: priceStats,
        filters: {
          retailer: retailer || null,
          fuelType: fuelType || null,
          postcode: postcode || null
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