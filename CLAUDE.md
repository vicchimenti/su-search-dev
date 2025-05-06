# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Seattle University Search API is a Next.js-based application that provides enhanced search functionality for the Seattle University website. It serves as a centralized search API with features including:

- Real-time search suggestions in a three-column layout (general, staff/faculty, programs)
- Tab-based navigation between different result categories
- Redis-based caching with in-memory fallback
- Session-based analytics tracking
- IP resolution from various headers for analytics

The application connects to Funnelback backend search services through a proxy while adding enhanced functionality and a modern user interface.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

## Environment Variables

Create a `.env.local` file with the following variables:

```
# Required
BACKEND_API_URL=https://funnelback-proxy-dev.vercel.app/proxy

# Optional - Redis configuration (if available)
REDIS_URL=redis://username:password@host:port
```

## Architecture

The application follows a client-server architecture:

1. **Client Side:**
   - React UI components
   - Client-side JavaScript modules for search management

2. **Next.js Server:**
   - API routes for search, suggestions, and client info
   - Utility and service layer

3. **External Services:**
   - Funnelback backend services
   - Redis for caching in production

## Key Components

### API Layer

- `/pages/api/search.ts`: Handles search requests with caching and tab-based content management
- `/pages/api/suggestions.ts`: Provides search suggestions for different categories
- `/pages/api/client-info.ts`: Handles client IP resolution for analytics

### Core Libraries

- `/lib/api-client.ts`: Configured Axios client for backend API communication
- `/lib/cache.ts`: Redis-based caching system with in-memory fallback
- `/lib/ip-service.ts`: IP resolution service to identify client information
- `/lib/utils.ts`: Utility functions for various operations

### Frontend

- `/components/SearchInput.tsx`: React component for search input with autocomplete
- `/components/ResultList.tsx`: Component that displays search results with tab navigation

### Client-side JavaScript

- `/public/integration.js`: Frontend search integration script for the Seattle University website
- `/public/js/SessionService.js`: Session ID management for analytics tracking
- `/public/js/modules/`: Various search manager modules (analytics, facets, pagination, etc.)

## Caching Strategy

The application implements a tiered caching strategy:

- **Redis Caching**: Used in production for shared caching across instances
- **In-Memory Cache**: Fallback for development or when Redis is unavailable

Different content types have optimized cache TTL values:
- Search results: 10 minutes
- Tab content: 30 minutes
- Popular tab content: 2 hours
- Suggestions: 5 minutes

## Deployment Information

The application uses an A/B environment structure:

- **Development Environment**:
  - Frontend: `su-search-dev`
  - Backend Proxy: `funnelback-proxy-dev`

- **Production Environment**:
  - Frontend: `su-search`
  - Backend Proxy: `funnelback-proxy`

For production deployment, the recommended approach is using Vercel:

```bash
# Create a tag
git tag snapshot-prod-YYYYMMDD

# Push the tag
git push origin snapshot-prod-YYYYMMDD

# Deploy from the tag
git checkout snapshot-prod-YYYYMMDD
vercel --prod
```