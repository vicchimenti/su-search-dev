# Seattle University Search API

A Next.js-based search API service that provides enhanced search functionality for the Seattle University website.

## Overview

This application serves as the centralized search API for Seattle University's website, providing fast and relevant search results, autocomplete suggestions, and analytics tracking. Built with Next.js, TypeScript, and React, the application integrates with Funnelback backend services while adding enhanced functionality, caching, and a modern user interface.

## Features

- **Powerful Search**: Quickly find content across the Seattle University website
- **Real-time Suggestions**: Three-column suggestion layout with general queries, staff/faculty, and programs
- **Faceted Search**: Filter results by category, content type, and other parameters
- **Tab Navigation**: Switch between different result categories (All Results, Faculty & Staff, Programs, News)
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Performance Optimized**: Redis caching and browser-side performance optimizations
- **Analytics Tracking**: Comprehensive tracking of search behavior for continuous improvement

## Architecture

The application follows a client-server architecture with Next.js providing both frontend and API capabilities:

```
┌─────────────────────────────────────────────┐
│                  Client Side                 │
│  ┌───────────┐    ┌───────────────────────┐ │
│  │ React UI  │◄───┤ Client-side JS Modules│ │
│  └───────────┘    └───────────────────────┘ │
└─────────────────────────────────────────────┘
               ▲                 ▲
               │                 │
               ▼                 ▼
┌─────────────────────────────────────────────┐
│                Next.js Server                │
│  ┌───────────┐    ┌───────────────────────┐ │
│  │API Routes │◄───┤Utility & Service Layer│ │
│  └───────────┘    └───────────────────────┘ │
└─────────────────────────────────────────────┘
               ▲                 ▲
               │                 │
               ▼                 ▼
┌─────────────────────────────────────────────┐
│                External Services             │
│  ┌───────────┐    ┌───────────────────────┐ │
│  │ Funnelback│    │         Redis         │ │
│  └───────────┘    └───────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm or yarn
- Redis (optional, for production caching)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/seattleu/search-api.git
   cd search-api
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file with the following variables:
   ```
   # Required
   BACKEND_API_URL=https://funnelback-proxy-dev.vercel.app/proxy
   
   # Optional - Redis configuration (if available)
   REDIS_URL=redis://username:password@host:port
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view the application

### Production Deployment

For production deployment, we recommend using Vercel:

```bash
npm install -g vercel
vercel
```

## API Endpoints

The application provides the following API endpoints:

### Search

```
GET /api/search
```

Parameters:
- `query` (required) - Search query
- `collection` - Collection name (default: 'seattleu~sp-search')
- `profile` - Profile name (default: '_default')
- `sessionId` - Session ID for analytics tracking

Returns: HTML search results

### Suggestions

```
GET /api/suggestions
```

Parameters:
- `query` (required) - Search query
- `type` - Suggestion type ('general', 'staff', 'programs', or all if omitted)
- `sessionId` - Session ID for analytics tracking

Returns: JSON array of suggestions

### Client Info

```
GET /api/client-info
```

Returns: Client IP information for analytics purposes

## Core Modules

The application includes several client-side JavaScript modules that provide enhanced functionality:

- **core-search-manager.js**: Central manager for search operations
- **analytics-manager.js**: Tracks user interactions for analytics
- **facets-manager.js**: Handles faceted search filtering
- **pagination-manager.js**: Manages results pagination
- **spelling-manager.js**: Processes spelling suggestions
- **tabs-manager.js**: Handles tab-based navigation

## Caching

The application implements a tiered caching strategy:

- **Redis Caching**: Used in production for shared caching across instances
- **In-Memory Cache**: Fallback for development or when Redis is unavailable
- **Browser Cache**: Appropriate cache headers for static assets

Different content types have optimized cache TTL values:
- Search results: 10 minutes
- Tab content: 30 minutes
- Popular tab content: 2 hours
- Suggestions: 5 minutes

## Configuration

The application can be configured through environment variables:

```
# Backend API
BACKEND_API_URL=https://funnelback-proxy-dev.vercel.app/proxy

# Redis Caching
REDIS_URL=redis://username:password@host:port

# Development
NODE_ENV=development|production
```

Client-side configuration can be adjusted in `public/js/search-bundle.js` or through the global `seattleUConfig` object.

## Development

### Project Structure

```
├── components/         # React components
├── lib/                # Utility libraries and services
├── pages/              # Next.js pages and API routes
│   ├── api/            # API endpoints
│   └── index.tsx       # Main search page
├── public/             # Static assets and client-side JS
│   ├── js/             # Client-side JavaScript modules
│   └── css/            # CSS styles
└── next.config.js      # Next.js configuration
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Seattle University Web Team
- Funnelback Search Platform
- Next.js Framework

## Contact

For questions or support, please contact:
- **Web Team**: webteam@seattleu.edu
- **Search Support**: searchsupport@seattleu.edu
