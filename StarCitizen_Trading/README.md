# Star Citizen Trading

A Node.js web application that displays real-time commodity trading data for Star Citizen, sourced from the UEX Corp API.

## Features

- 📊 **Real-time commodity prices** from UEX Corp API
- 🔄 **Auto-refresh** data every minute (configurable)
- 💰 **Profit calculations** for all trading routes
- 🗺️ **System/terminal mapping** with location codes
- 📱 **Touch Portal interface** for custom SCU capacities
- 🎨 **Dark theme** optimized for readability
- 📝 **Comprehensive logging** with Winston
- 🛡️ **Robust error handling** with retry logic
- ⚡ **Production-ready** code with tests

## Installation

### Prerequisites

- Node.js 20+ (tested with v20.19.2)
- npm

### Setup

1. Clone the repository:
```bash
git clone https://github.com/dodoslavn/StarCitizen_Trading.git
cd StarCitizen_Trading/StarCitizen_Trading
```

2. Install dependencies:
```bash
npm install
```

3. Create configuration file:
```bash
cp config.json.example config.json
```

4. Edit `config.json` with your settings (see Configuration section)

5. Start the server:
```bash
npm start
```

The server will be available at `http://localhost:3000` (or your configured port).

## Configuration

Edit `config.json` to customize the application:

```json
{
  "http_server": {
    "ip_listen": "127.0.0.1",
    "port_listen": "3000"
  },
  "api": {
    "base_url": "https://api.uexcorp.space/2.0",
    "endpoints": {
      "prices_all": "/commodities_prices_all",
      "solar_systems_all": "/star_systems",
      "terminals_all": "/terminals"
    },
    "timeout": 10000,
    "retries": 3
  },
  "cache": {
    "refresh_interval_minutes": 1
  },
  "logging": {
    "level": "info",
    "file": "trading.log",
    "console": true
  }
}
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `http_server.ip_listen` | IP address to bind to | `127.0.0.1` |
| `http_server.port_listen` | Port number | `3000` |
| `api.timeout` | API request timeout (ms) | `10000` |
| `api.retries` | Number of retry attempts | `3` |
| `cache.refresh_interval_minutes` | Data refresh frequency | `1` |
| `logging.level` | Log level (error/warn/info/debug) | `info` |
| `logging.file` | Log file path | `trading.log` |
| `logging.console` | Enable console logging | `true` |

## Usage

### Web Interface

Navigate to `http://localhost:3000` to see:

- **Main Page** (`/`): All commodities with buy/sell prices and profit calculations
- **About** (`/about`): Information about the website
- **Touch Portal** (`/touchportal/[scu]/[system]`): Optimized for specific cargo capacities
- **Refresh** (`/refresh`): Manually trigger data refresh

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Main trading data page |
| `/about` | About page |
| `/default.css` | Stylesheet |
| `/favicon.ico` | Favicon |
| `/refresh` | Trigger manual data refresh |
| `/touchportal/[scu]` | Touch portal for specific SCU |
| `/touchportal/[scu]/[system]` | Touch portal filtered by system |

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### Development Mode

```bash
npm run dev
```

## Architecture

### Project Structure

```
StarCitizen_Trading/
├── server.js           # Main server entry point
├── functions.js        # Core business logic and HTTP handlers
├── html.js             # HTML generation and rendering
├── dataCache.js        # Data caching management
├── logger.js           # Winston logger configuration
├── favicon.js          # Base64 encoded favicon
├── config.json         # Configuration (create from .example)
├── config.json.example # Example configuration
├── package.json        # Dependencies and scripts
├── .eslintrc.json      # ESLint configuration
└── tests/              # Unit tests
    ├── dataCache.test.js
    └── html.test.js
```

### Key Components

#### DataCache

Manages in-memory caching of:
- Commodity price data
- System/terminal mappings
- Profit calculations

#### Functions

Core business logic:
- API data fetching with retry logic
- Data normalization
- HTTP request routing
- Response generation

#### HTML Module

Rendering engine for:
- Commodity tables
- Profit summaries
- Touch portal interface

## Improvements (v1.0.0)

This version includes major refactoring and production-ready improvements:

### Code Quality
- ✅ **ESLint** integration with standard config
- ✅ **JSDoc** comments on all functions
- ✅ **Unit tests** with Jest
- ✅ **Modular architecture** with clear separation of concerns

### Reliability
- ✅ **Retry logic** with exponential backoff
- ✅ **Timeout handling** for API requests
- ✅ **HTTP status checking** on all fetches
- ✅ **Graceful error handling** with fallbacks

### Observability
- ✅ **Winston logging** replacing console.log
- ✅ **Configurable log levels** (debug/info/warn/error)
- ✅ **File and console** logging
- ✅ **Request tracking** with client IPs

### Performance
- ✅ **Replaced globals** with DataCache class
- ✅ **Parallel API calls** where possible
- ✅ **Efficient data structures**

### User Experience
- ✅ **Better error pages** (404, 503, 500)
- ✅ **Graceful shutdown** handling
- ✅ **Configuration validation**

## Data Source

All trading data is sourced from the [UEX Corp API](https://uexcorp.space/), a community-driven Star Citizen resource.

## License

See [LICENSE](../LICENSE.txt) for details.

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure `npm test` and `npm run lint` pass
5. Submit a pull request

## Credits

- **Author**: Dodoslav Novak
- **Data**: UEX Corp API
- **Community**: Star Citizen players

## Support

For issues or questions:
- Open an issue on GitHub
- Email: admin@dodoslav.eu

---

Built for the Star Citizen community 🚀
