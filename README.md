# UK Fuel Price Tracker

A comprehensive fuel price tracking system that monitors prices from 14 major UK fuel retailers using the CMA temporary pricing scheme. Built with Next.js and deployed on Vercel with automated data collection via GitHub Actions.

## 🚀 Features

- **Real-time Price Display**: Shows current fuel prices from all major UK retailers
- **Smart Filtering**: Filter by fuel type (E10, E5, B7, SDV) and postcode
- **Location-based Search**: Find cheapest stations near your location
- **Price Statistics**: Min/max/average prices with visual indicators
- **Historical Data**: Automated archiving of price changes over time
- **Mobile Responsive**: Works perfectly on all devices
- **24/7 Automated Collection**: GitHub Actions fetch prices every hour

## 📊 Data Sources

Data is collected from 14 major UK fuel retailers:
- Asda, BP, Esso Tesco Alliance, JET, Morrisons, Moto
- Motor Fuel Group, Rontec, Sainsbury's, SGN, Shell, Tesco
- Ascona Group, Karan Retail Ltd

All data sourced from the [CMA temporary pricing scheme](https://www.gov.uk/guidance/access-fuel-price-data).

## 🏗️ Architecture

### Frontend
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React Components** for interactive UI

### Backend
- **Vercel API Routes** for serverless functions
- **GitHub Storage** for data persistence
- **Octokit** for GitHub API integration

### Automation
- **GitHub Actions** for scheduled data collection
- **Vercel Deployment** for continuous deployment
- **Error Handling** with failure notifications

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd fuel-price-tracker/app
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env.local` and configure:

```env
# GitHub Configuration (required for data storage)
GITHUB_TOKEN=ghp_your_github_token_here
GITHUB_OWNER=sweir1
GITHUB_REPO=UKFuelTracker

# Security (optional)
CRON_SECRET=your-secret-for-cron-jobs
```

### 3. GitHub Token Setup
1. Go to GitHub Settings > Developer Settings > Personal Access Tokens
2. Create a token with `repo` permissions
3. Add it to your environment variables

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## 📱 API Endpoints

### `/api/fetch`
Fetches live data from all retailers
- **Query params**: `retailer` (optional)
- **Returns**: Collection summary and results

### `/api/prices/current`
Get current prices with filtering
- **Query params**: `fuel_type`, `retailer`, `postcode`
- **Returns**: Filtered station list with price statistics

### `/api/stations/cheapest`
Find cheapest stations
- **Query params**: `fuel`, `lat`, `lng`, `max_distance`, `limit`
- **Returns**: Ranked list of cheapest stations

### `/api/save`
Automated data collection endpoint (used by GitHub Actions)
- **Method**: POST
- **Auth**: Bearer token required
- **Returns**: Save operation summary

## 🔄 Data Collection

### Automatic Collection
GitHub Actions runs every hour to:
1. Fetch data from all 14 retailers
2. Save current prices to `data/current/`
3. Archive significant changes to `data/archive/`
4. Handle errors gracefully with retries

### Manual Collection
```bash
cd app
node scripts/collect-data.js
```

### Data Structure
```
data/
├── current/           # Latest prices (updated hourly)
│   ├── asda.json
│   ├── tesco.json
│   └── ...
└── archive/           # Historical data
    └── 2024/01/15/   # Organized by date
        ├── asda-14-30-00.json
        └── ...
```

## 🚀 Deployment

### Deploy to Vercel

1. **Fork this repository**
2. **Connect to Vercel**:
   ```bash
   npx vercel --cwd app
   ```
3. **Set Environment Variables** in Vercel dashboard:
   - `GITHUB_TOKEN` → Your GitHub personal access token (create from GitHub Settings)
   - `GITHUB_OWNER` → `sweir1`
   - `GITHUB_REPO` → `UKFuelTracker`
   - `CRON_SECRET` → `your-secret-for-cron-jobs` (optional)

4. **Enable GitHub Actions**:
   - Ensure Actions are enabled in repository settings
   - The workflow will run automatically every hour

### Custom Domain (Optional)
Add your custom domain in Vercel dashboard under Project Settings > Domains.

## 🛠️ Development

### Project Structure
```
src/
├── app/
│   ├── api/           # API routes
│   ├── globals.css    # Global styles
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Home page
├── components/        # React components
├── lib/              # Utility functions
└── types/            # TypeScript definitions
```

### Adding New Retailers
1. Update `src/lib/retailers.ts`
2. Add retailer configuration with URL and enabled status
3. Test data format compatibility

### Custom Styling
Built with Tailwind CSS. Customize in:
- `tailwind.config.ts` for theme configuration
- `src/app/globals.css` for global styles

## 📈 Monitoring

### GitHub Actions Logs
View collection status in repository Actions tab.

### Vercel Analytics
Monitor API performance in Vercel dashboard.

### Error Handling
- Automatic retries for failed requests
- Graceful degradation when retailers are unavailable
- Detailed logging for debugging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## ⚠️ Disclaimer

This tool is for informational purposes only. Fuel prices may have delays and should always be verified at the forecourt before purchase. Data is sourced from the CMA temporary pricing scheme and accuracy depends on retailer data quality.
