#!/usr/bin/env node

import { Octokit } from '@octokit/rest';
import { format } from 'date-fns';

// Retailer configuration
const RETAILERS = [
  {
    name: 'Ascona Group',
    url: 'https://fuelprices.asconagroup.co.uk/newfuel.json',
    enabled: true
  },
  {
    name: 'Asda',
    url: 'https://storelocator.asda.com/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'BP',
    url: 'https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'Esso Tesco Alliance',
    url: 'https://fuelprices.esso.co.uk/latestdata.json',
    enabled: true
  },
  {
    name: 'JET Retail UK',
    url: 'https://jetlocal.co.uk/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'Karan Retail Ltd',
    url: 'https://api.krl.live/integration/live_price/krl',
    enabled: true
  },
  {
    name: 'Morrisons',
    url: 'https://www.morrisons.com/fuel-prices/fuel.json',
    enabled: true
  },
  {
    name: 'Moto',
    url: 'https://moto-way.com/fuel-price/fuel_prices.json',
    enabled: true
  },
  {
    name: 'Motor Fuel Group',
    url: 'https://fuel.motorfuelgroup.com/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'Rontec',
    url: 'https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'Sainsburys',
    url: 'https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json',
    enabled: true
  },
  {
    name: 'SGN',
    url: 'https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json',
    enabled: true
  },
  {
    name: 'Shell',
    url: 'https://www.shell.co.uk/fuel-prices-data.html',
    enabled: false // HTML format, needs special handling
  },
  {
    name: 'Tesco',
    url: 'https://www.tesco.com/fuel_prices/fuel_prices_data.json',
    enabled: true
  }
];

class GitHubStorage {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
    this.owner = process.env.GITHUB_OWNER;
    this.repo = process.env.GITHUB_REPO;
  }

  async saveCurrentData(retailer, data) {
    const filename = `data/current/${retailer.toLowerCase().replace(/\s+/g, '-')}.json`;
    const content = JSON.stringify(data, null, 2);

    try {
      // Try to get existing file to get SHA
      let sha;
      try {
        const existing = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filename,
        });
        
        if ('sha' in existing.data) {
          sha = existing.data.sha;
        }
      } catch (error) {
        // File doesn't exist, which is fine for new files
        if (error.status !== 404) {
          throw error;
        }
      }

      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: filename,
        message: `Update ${retailer} fuel prices - ${data.last_updated}`,
        content: Buffer.from(content).toString('base64'),
        sha: sha,
      });

      console.log(`✅ Saved current data for ${retailer} to GitHub`);
    } catch (error) {
      console.error(`❌ Failed to save current data for ${retailer}:`, error.message);
      throw error;
    }
  }

  async archiveData(retailer, data) {
    const date = new Date(data.last_updated || new Date());
    const year = format(date, 'yyyy');
    const month = format(date, 'MM');
    const day = format(date, 'dd');
    const timestamp = format(date, 'HH-mm-ss');
    
    const filename = `data/archive/${year}/${month}/${day}/${retailer.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.json`;
    const content = JSON.stringify(data, null, 2);

    try {
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: filename,
        message: `Archive ${retailer} fuel prices - ${data.last_updated}`,
        content: Buffer.from(content).toString('base64'),
      });

      console.log(`✅ Archived data for ${retailer} to GitHub`);
    } catch (error) {
      console.error(`❌ Failed to archive data for ${retailer}:`, error.message);
    }
  }

  async shouldArchiveData(retailer, newData) {
    // For GitHub Actions, always archive every 6 hours based on current time
    const currentTime = new Date();
    const hour = currentTime.getHours();
    
    // Archive at 00:00, 06:00, 12:00, 18:00 UTC
    return hour % 6 === 0;
  }
}

async function fetchRetailerData(retailer) {
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 1) {
        console.log(`🔄 Fetching from ${retailer.name}...`);
      } else {
        console.log(`🔄 Retrying ${retailer.name} (attempt ${attempt}/${maxRetries})...`);
        // Add delay between retries (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(retailer.url, {
        headers: {
          'User-Agent': 'UK-Fuel-Tracker/1.0 (GitHub Actions)',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`Expected JSON, got ${contentType}`);
      }

      const data = await response.json();
      
      // Validate data structure
      if (!data.stations || !Array.isArray(data.stations)) {
        throw new Error('Invalid data format: missing stations array');
      }

      // Ensure last_updated is set
      if (!data.last_updated) {
        data.last_updated = new Date().toISOString();
      }

      console.log(`✅ ${retailer.name}: ${data.stations.length} stations`);
      return { retailer: retailer.name, success: true, data, stationCount: data.stations.length };
      
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        console.log(`⚠️  ${retailer.name} attempt ${attempt} failed: ${error.message}`);
      } else {
        console.error(`❌ ${retailer.name} failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
  
  return { retailer: retailer.name, success: false, error: lastError.message };
}

async function main() {
  console.log('🚀 Starting UK Fuel Price Data Collection');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('');

  // Validate environment variables
  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }
  if (!process.env.GITHUB_OWNER) {
    console.error('❌ GITHUB_OWNER environment variable is required');
    process.exit(1);
  }
  if (!process.env.GITHUB_REPO) {
    console.error('❌ GITHUB_REPO environment variable is required');
    process.exit(1);
  }

  const storage = new GitHubStorage();
  
  // Fetch data from all enabled retailers
  const enabledRetailers = RETAILERS.filter(r => r.enabled);
  console.log(`📡 Fetching data from ${enabledRetailers.length} retailers...`);
  console.log('');

  const results = [];
  
  // Fetch data in batches to avoid overwhelming the APIs
  const batchSize = 3;
  for (let i = 0; i < enabledRetailers.length; i += batchSize) {
    const batch = enabledRetailers.slice(i, i + batchSize);
    const batchPromises = batch.map(retailer => fetchRetailerData(retailer));
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`❌ Batch error: ${result.reason?.message}`);
      }
    });
    
    // Small delay between batches
    if (i + batchSize < enabledRetailers.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('');
  console.log('💾 Saving data to GitHub...');

  // Save successful results
  const successfulResults = results.filter(r => r.success);
  let savedCount = 0;
  let archivedCount = 0;

  for (const result of successfulResults) {
    try {
      await storage.saveCurrentData(result.retailer, result.data);
      savedCount++;
      
      // Archive data if conditions are met
      const shouldArchive = await storage.shouldArchiveData(result.retailer, result.data);
      if (shouldArchive) {
        await storage.archiveData(result.retailer, result.data);
        archivedCount++;
      }
    } catch (error) {
      console.error(`❌ Failed to save data for ${result.retailer}:`, error.message);
    }
  }

  // Summary
  const totalStations = successfulResults.reduce((sum, r) => sum + (r.stationCount || 0), 0);
  
  console.log('');
  console.log('📊 Collection Summary:');
  console.log(`✅ Successful fetches: ${successfulResults.length}/${results.length}`);
  console.log(`❌ Failed fetches: ${results.length - successfulResults.length}/${results.length}`);
  console.log(`🏪 Total stations: ${totalStations.toLocaleString()}`);
  console.log(`💾 Data files saved: ${savedCount}`);
  console.log(`📁 Data files archived: ${archivedCount}`);
  
  if (results.length - successfulResults.length > 0) {
    console.log('');
    console.log('❌ Failed retailers:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.retailer}: ${r.error}`);
    });
  }

  // Exit with error code if too many failures
  const failureRate = (results.length - successfulResults.length) / results.length;
  if (failureRate > 0.5) {
    console.log('');
    console.error('❌ Too many failures (>50%), marking workflow as failed');
    process.exit(1);
  }

  console.log('');
  console.log('🎉 Data collection completed successfully!');
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}