import { NextRequest, NextResponse } from 'next/server';
import { GitHubStorage } from '@/lib/github-storage';
import { RETAILERS } from '@/lib/retailers';
import { FuelData } from '@/types/fuel';

export async function POST(request: NextRequest) {
  try {
    // Verify this is called from a scheduled task or authorized source
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storage = new GitHubStorage();
    const results: { retailer: string; success: boolean; data?: FuelData; error?: string; stationCount?: number }[] = [];

    console.log('Starting bulk data fetch and save...');

    // Fetch data from all enabled retailers
    const fetchPromises = RETAILERS.filter(r => r.enabled).map(async (retailerConfig) => {
      try {
        console.log(`Fetching from ${retailerConfig.name}...`);
        
        const response = await fetch(retailerConfig.url, {
          headers: {
            'User-Agent': 'UK-Fuel-Tracker/1.0',
            'Accept': 'application/json'
          },
          // Don't cache responses in this context
          cache: 'no-store'
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

        // Ensure last_updated is set
        if (!data.last_updated) {
          data.last_updated = new Date().toISOString();
        }

        console.log(`Successfully fetched ${data.stations.length} stations from ${retailerConfig.name}`);

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

    // Wait for all fetches to complete
    const fetchResults = await Promise.allSettled(fetchPromises);
    
    fetchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          retailer: RETAILERS[index].name,
          success: false,
          error: result.reason?.message || 'Promise rejected'
        });
      }
    });

    console.log(`Fetch completed. Successful: ${results.filter(r => r.success).length}/${results.length}`);

    // Save successful results to GitHub
    try {
      const successfulResults = results
        .filter(result => result.success && result.data)
        .map(result => ({
          retailer: result.retailer,
          data: result.data!,
          success: result.success
        }));
      
      await storage.saveBulkData(successfulResults);
      console.log('Successfully saved data to GitHub');
    } catch (error) {
      console.error('Failed to save bulk data:', error);
      return NextResponse.json({
        error: 'Failed to save data to GitHub',
        details: error instanceof Error ? error.message : 'Unknown error',
        fetchResults: results
      }, { status: 500 });
    }

    const successCount = results.filter(r => r.success).length;
    const totalStations = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.stationCount || 0), 0);

    const summary = {
      timestamp: new Date().toISOString(),
      totalRetailers: results.length,
      successfulFetches: successCount,
      failedFetches: results.length - successCount,
      totalStations: totalStations,
      savedToGitHub: true
    };

    console.log('Data collection summary:', summary);

    return NextResponse.json({
      summary,
      results: results.map(r => ({
        retailer: r.retailer,
        success: r.success,
        stationCount: r.stationCount,
        error: r.error
      }))
    });

  } catch (error) {
    console.error('API save error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET() {
  return POST(new NextRequest('http://localhost/api/save', { method: 'POST' }));
}