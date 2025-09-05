import { NextRequest, NextResponse } from 'next/server';
import { RETAILERS } from '@/lib/retailers';
import { FuelData } from '@/types/fuel';

interface FetchResult {
  retailer: string;
  success: boolean;
  data?: FuelData;
  error?: string;
  stationCount?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const retailer = searchParams.get('retailer');
  
  try {
    const results: FetchResult[] = [];
    const retailersToFetch = retailer 
      ? RETAILERS.filter(r => r.name.toLowerCase() === retailer.toLowerCase() && r.enabled)
      : RETAILERS.filter(r => r.enabled);

    const fetchPromises = retailersToFetch.map(async (retailerConfig) => {
      try {
        console.log(`Fetching data from ${retailerConfig.name}...`);
        
        const response = await fetch(retailerConfig.url, {
          headers: {
            'User-Agent': 'UK-Fuel-Tracker/1.0',
            'Accept': 'application/json'
          },
          next: { revalidate: 0 } // Don't cache
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error(`Expected JSON, got ${contentType}`);
        }

        const data: FuelData = await response.json();
        
        // Validate data structure
        if (!data.stations || !Array.isArray(data.stations)) {
          throw new Error('Invalid data format: missing stations array');
        }

        return {
          retailer: retailerConfig.name,
          success: true,
          data: data,
          stationCount: data.stations.length
        };
      } catch (error) {
        console.error(`Failed to fetch from ${retailerConfig.name}:`, error);
        return {
          retailer: retailerConfig.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const fetchResults = await Promise.allSettled(fetchPromises);
    
    fetchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          retailer: retailersToFetch[index].name,
          success: false,
          error: result.reason?.message || 'Promise rejected'
        });
      }
    });

    const successCount = results.filter(r => r.success).length;
    const totalStations = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.stationCount || 0), 0);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        totalRetailers: results.length,
        successfulFetches: successCount,
        failedFetches: results.length - successCount,
        totalStations: totalStations
      },
      results: results
    });

  } catch (error) {
    console.error('API fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET(new NextRequest('http://localhost/api/fetch'));
}