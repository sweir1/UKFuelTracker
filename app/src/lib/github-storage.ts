import { Octokit } from '@octokit/rest';
import { FuelData } from '@/types/fuel';
import { format } from 'date-fns';

export class GitHubStorage {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    if (!process.env.GITHUB_OWNER) {
      throw new Error('GITHUB_OWNER environment variable is required');
    }
    if (!process.env.GITHUB_REPO) {
      throw new Error('GITHUB_REPO environment variable is required');
    }

    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
    this.owner = process.env.GITHUB_OWNER;
    this.repo = process.env.GITHUB_REPO;
  }

  async saveCurrentData(retailer: string, data: FuelData): Promise<void> {
    const filename = `data/current/${retailer.toLowerCase().replace(/\s+/g, '-')}.json`;
    const content = JSON.stringify(data, null, 2);

    try {
      // Try to get existing file to get SHA
      let sha: string | undefined;
      try {
        const existing = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filename,
        });
        
        if ('sha' in existing.data) {
          sha = existing.data.sha;
        }
      } catch (error: any) {
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

      console.log(`Saved current data for ${retailer} to GitHub`);
    } catch (error) {
      console.error(`Failed to save current data for ${retailer}:`, error);
      throw error;
    }
  }

  async archiveData(retailer: string, data: FuelData): Promise<void> {
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

      console.log(`Archived data for ${retailer} to GitHub`);
    } catch (error) {
      console.error(`Failed to archive data for ${retailer}:`, error);
      throw error;
    }
  }

  async getCurrentData(retailer?: string): Promise<{ [key: string]: FuelData }> {
    try {
      const { data: contents } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: 'data/current',
      });

      if (!Array.isArray(contents)) {
        return {};
      }

      const result: { [key: string]: FuelData } = {};

      for (const file of contents) {
        if (file.type === 'file' && file.name.endsWith('.json')) {
          const retailerName = file.name.replace('.json', '');
          
          if (retailer && !retailerName.includes(retailer.toLowerCase().replace(/\s+/g, '-'))) {
            continue;
          }

          try {
            const { data: fileData } = await this.octokit.rest.repos.getContent({
              owner: this.owner,
              repo: this.repo,
              path: file.path,
            });

            if ('content' in fileData) {
              const content = Buffer.from(fileData.content, 'base64').toString();
              result[retailerName] = JSON.parse(content);
            }
          } catch (error) {
            console.error(`Failed to read ${file.name}:`, error);
            continue;
          }
        }
      }

      return result;
    } catch (error: any) {
      if (error.status === 404) {
        // data/current directory doesn't exist yet
        return {};
      }
      console.error('Failed to get current data from GitHub:', error);
      throw error;
    }
  }

  async getHistoricalData(retailer: string, days: number = 7): Promise<FuelData[]> {
    try {
      const result: FuelData[] = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const year = format(date, 'yyyy');
        const month = format(date, 'MM');
        const day = format(date, 'dd');
        
        try {
          const { data: dayContents } = await this.octokit.rest.repos.getContent({
            owner: this.owner,
            repo: this.repo,
            path: `data/archive/${year}/${month}/${day}`,
          });

          if (Array.isArray(dayContents)) {
            const retailerFiles = dayContents.filter(file => 
              file.type === 'file' && 
              file.name.startsWith(retailer.toLowerCase().replace(/\s+/g, '-')) &&
              file.name.endsWith('.json')
            );

            for (const file of retailerFiles) {
              try {
                const { data: fileData } = await this.octokit.rest.repos.getContent({
                  owner: this.owner,
                  repo: this.repo,
                  path: file.path,
                });

                if ('content' in fileData) {
                  const content = Buffer.from(fileData.content, 'base64').toString();
                  result.push(JSON.parse(content));
                }
              } catch (error) {
                console.error(`Failed to read historical file ${file.name}:`, error);
                continue;
              }
            }
          }
        } catch (error: any) {
          if (error.status !== 404) {
            console.error(`Failed to read archive for ${year}/${month}/${day}:`, error);
          }
          continue;
        }
      }

      return result.sort((a, b) => 
        new Date(b.last_updated || 0).getTime() - new Date(a.last_updated || 0).getTime()
      );
    } catch (error) {
      console.error('Failed to get historical data:', error);
      throw error;
    }
  }

  async saveBulkData(results: { retailer: string; data: FuelData; success: boolean }[]): Promise<void> {
    const promises = results
      .filter(result => result.success && result.data)
      .map(async (result) => {
        try {
          await this.saveCurrentData(result.retailer, result.data);
          
          // Also archive data if it's significantly different or if it's been a while
          const shouldArchive = await this.shouldArchiveData(result.retailer, result.data);
          if (shouldArchive) {
            await this.archiveData(result.retailer, result.data);
          }
        } catch (error) {
          console.error(`Failed to save data for ${result.retailer}:`, error);
        }
      });

    await Promise.allSettled(promises);
  }

  private async shouldArchiveData(retailer: string, newData: FuelData): Promise<boolean> {
    try {
      const currentData = await this.getCurrentData(retailer);
      const existingData = currentData[retailer.toLowerCase().replace(/\s+/g, '-')];
      
      if (!existingData) {
        return true; // First time saving data
      }

      // Check if it's been more than 24 hours
      const lastUpdate = new Date(existingData.last_updated || 0);
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate >= 24) {
        return true;
      }

      // Check if there are significant price changes (more than 5% of stations changed)
      const totalStations = newData.stations.length;
      let changedStations = 0;
      
      for (const newStation of newData.stations) {
        const existingStation = existingData.stations.find(s => s.site_id === newStation.site_id);
        if (!existingStation) {
          changedStations++;
          continue;
        }
        
        // Check if any fuel price changed by more than 1p
        for (const [fuelType, price] of Object.entries(newStation.prices)) {
          const existingPrice = existingStation.prices[fuelType];
          if (!existingPrice || Math.abs(price - existingPrice) > 1) {
            changedStations++;
            break;
          }
        }
      }

      return (changedStations / totalStations) > 0.05; // More than 5% of stations changed
    } catch (error) {
      console.error('Error checking if should archive:', error);
      return false;
    }
  }
}