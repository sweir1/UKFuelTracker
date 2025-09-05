import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { FuelData, FuelStation } from '@/types/fuel';
import { GitHubStorage } from '@/lib/github-storage';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const retailer = searchParams.get('retailer');
  const fuelType = searchParams.get('fuel_type');
  const postcode = searchParams.get('postcode');
  
  try {
    const currentDataPath = path.join(process.cwd(), 'data', 'current');
    
    // Try to read from local files first, fallback to GitHub
    let allStations: FuelStation[] = [];
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
        } catch (error) {
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
        dataSource: dataSource,
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