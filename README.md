# Seattle University Search Development API

A Next.js-based search API service that serves as the development and testing environment for Seattle University's search functionality. This application is where new search features are built, optimized, and validated before deployment to production.

## Overview

This repository contains the development version of Seattle University's search API, providing a sophisticated testing ground for search functionality enhancements. Built with Next.js, TypeScript, and React, the application integrates with Funnelback backend services while serving as the innovation platform for advanced search features, performance optimizations, and user experience improvements.

**Primary Purpose**: Development and testing of new search features before production deployment  
**Secondary Purpose**: Emergency backup system for production search (A/B deployment strategy)  
**Current Status**: Optimized 2-tier search architecture with advanced caching and session management

## Features

- **High-Performance Search**: Optimized search with 424ms cache hit performance and 1070ms cache miss performance
- **Advanced Caching**: Multi-tier caching strategy with Redis backend and intelligent TTL management
- **Real-time Suggestions**: Three-column suggestion layout with general queries, staff/faculty, and programs
- **Pre-rendering Capability**: Smart pre-rendering system for near-instantaneous search results
- **Faceted Search**: Advanced filtering with comprehensive analytics tracking
- **Tab Navigation**: Dynamic result categorization (All Results, Faculty & Staff, Programs, News)
- **Session Management**: Sophisticated SessionService integration for analytics continuity
- **Collapsible Interface**: Organized search results with expandable sections
- **Comprehensive Analytics**: Detailed tracking of search behavior, interactions, and performance metrics
- **Responsive Design**: Optimized experience across desktop and mobile devices

## Architecture

The application implements a modern client-server architecture with performance optimization as a core principle:

```text
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   React UI  │  │ Integration │  │ Client-side Modules │  │
│  │ Components  │◄─┤   Scripts   │◄─┤ (Analytics, Cache)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ Optimized 2-tier Search Flow
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js API Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Search API  │  │Pre-render   │  │   SessionService    │  │
│  │ Endpoints   │◄─┤   System    │◄─┤   Integration       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ Cached + Direct Backend Access
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                External Services Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Funnelback  │  │    Redis    │  │   Analytics APIs    │  │
│  │   Backend   │  │    Cache    │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Search Flow Architecture

The application implements an optimized 2-tier search flow:

1. **Pre-render Check**: Fast cache lookup for pre-rendered content (target: <300ms)
2. **Standard Search**: Direct backend search with intelligent caching (fallback)

This architecture eliminates redundant operations and provides consistent, measurable performance.

## Performance Metrics

### Current Performance Baselines

| Search Type | Cache Status | Performance | Target |
|-------------|--------------|-------------|---------|
| URL Parameter Search | Cache HIT | 424ms | Optimized ✅ |
| URL Parameter Search | Cache MISS | 1070ms | Optimized ✅ |
| Direct Search Input | Cache HIT | 307ms | Excellent ✅ |
| Direct Search Input | Cache MISS | 694ms | Excellent ✅ |

### Cache TTL Strategy

Different content types use optimized cache durations:

- **Search Results**: 12 hours (popular queries: 16-18 hours)
- **Tab Content**: 14 hours (popular tabs: 20 hours)  
- **Suggestions**: 5 minutes
- **Client Info**: No cache (real-time)

## Environment Structure

This application uses an A/B deployment strategy:

### Development Environment (This Repository)

- **Frontend**: `su-search-dev` → [https://su-search-dev.vercel.app](https://su-search-dev.vercel.app)
- **Backend Proxy**: `funnelback-proxy-dev`
- **Purpose**: Feature development, testing, optimization
- **Vercel Dashboard**: [https://vercel.com/su-web-ops/su-search-dev](https://vercel.com/su-web-ops/su-search-dev)

### Production Environment

- **Frontend**: `su-search` → [https://su-search.vercel.app](https://su-search.vercel.app) 
- **Backend Proxy**: `funnelback-proxy`
- **Purpose**: Live search functionality for Seattle University
- **Deployment Source**: Validated features from this development repository

### Emergency Backup Protocol

In case of production system failure, this development environment can serve as an emergency backup while production issues are resolved.

## Getting Started

### Prerequisites

- Node.js 16.x or higher (recommended: Node.js 18+)
- npm or yarn package manager
- Redis instance (optional for local development, required for production-like testing)
- Git for version control

### Local Development Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/vicchimenti/su-search-dev.git
   cd su-search-dev
   ```

2. **Install dependencies**:

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment variables**

   Create a `.env.local` file with the following configuration:

   ```bash
   # Required - Backend API Configuration
   BACKEND_API_URL=https://funnelback-proxy-dev.vercel.app/proxy
   
   # Optional - Redis Configuration (for production-like caching)
   KV_URL=redis://username:password@host:port/database
   REDIS_URL=redis://username:password@host:port/database
   
   # Optional - Development Configuration
   NODE_ENV=development
   CACHE_LOG_LEVEL=2
   API_CLIENT_LOG_LEVEL=2
   ```

4. **Start the development server**:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Access the application**:
   - Local development: [http://localhost:3000](http://localhost:3000)
   - Local search page: [http://localhost:3000/search-test](http://localhost:3000/search-test)

### Production Deployment

#### Creating a Deployment Snapshot

Before deploying significant features or optimizations:

```bash
# Create a snapshot tag with current date
git tag snapshot-dev-$(date +%Y%m%d)
git push origin snapshot-dev-$(date +%Y%m%d)

# List all development snapshots
git tag -l "snapshot-dev-*"
```

#### Deployment to Production (`su-search`)

1. **Validate in development environment**:
   - Verify all features work correctly
   - Confirm performance metrics meet targets
   - Test edge cases and error handling

2. **Deploy to production**:

   ```bash
   # Deploy current state to production environment
   npm install -g vercel
   vercel --prod
   ```

3. **Post-deployment validation**:
   - Monitor performance metrics
   - Verify analytics tracking
   - Test key user flows

## API Endpoints

### Search Endpoints

#### Primary Search

```http
GET /api/search
```

**Parameters**:

- `query` (required) - Search query string
- `collection` (optional) - Collection name (default: 'seattleu~sp-search')
- `profile` (optional) - Profile name (default: '_default')
- `sessionId` (optional) - Session ID for analytics tracking
- `form` (optional) - Form type (default: 'partial')

**Returns**: HTML search results with cache headers

#### Suggestions

```http
GET /api/suggestions
```

**Parameters**:

- `query` (required) - Search query string
- `type` (optional) - Suggestion type ('general', 'staff', 'programs', or all)
- `sessionId` (optional) - Session ID for analytics tracking

**Returns**: JSON object with categorized suggestions

#### Pre-render (Performance Optimization)

```http
POST /api/pre-render
```

**Body**:

```json
{
  "query": "search query",
  "sessionId": "optional-session-id",
  "collection": "optional-collection",
  "profile": "optional-profile"
}
```

**Returns**: Acceptance confirmation (202) - caching happens in background

### Utility Endpoints

#### Client Information

```http
GET /api/client-info
```

**Returns**: Client IP and network information for analytics

#### Cache Check

```http
GET /api/check-cache
```

**Parameters**:

- `query` (required) - Query to check in cache
- `collection` (optional) - Collection name
- `profile` (optional) - Profile name

**Returns**: Cache existence status and TTL information

#### Prefetch (Performance Enhancement)

```http
GET /api/prefetch
```

**Parameters**:

- `query` (required) - Query to prefetch
- `sessionId` (optional) - Session ID
- `ttl` (optional) - Custom cache TTL

**Returns**: Prefetch acceptance status

## Client-Side Modules

The application includes sophisticated client-side modules for enhanced functionality:

### Core Modules

- **`core-search-manager.js`**: Central coordinator for all search operations with optimized caching
- **`integration.js`**: Main integration script with smart pre-rendering capabilities
- **`SessionService.js`**: Advanced session management with redirect optimization

### Feature Modules

- **`analytics-manager.js`**: Comprehensive tracking of user interactions and search behavior
- **`tabs-manager.js`**: Dynamic tab navigation with performance optimizations
- **`facets-manager.js`**: Advanced faceted search with analytics integration
- **`pagination-manager.js`**: Efficient results pagination management
- **`collapse-manager.js`**: Collapsible interface elements with smooth animations
- **`spelling-manager.js`**: Spelling suggestion processing and query enhancement

### Utility Modules

- **`search-bundle.js`**: Unified client-side bundle for CMS integration
- **`search-page-autocomplete.js`**: Advanced autocomplete with three-column suggestions

## Development Workflow

### Project Structure

```text
su-search-dev/
├── components/             # React components
│   ├── ResultList.tsx     # Search results display
│   └── SearchInput.tsx    # Search input with suggestions
├── lib/                   # Core utilities and services
│   ├── api-client.ts      # Backend API client with IP forwarding
│   ├── cache.ts           # Multi-tier caching implementation
│   ├── ip-service.ts      # Client IP resolution
│   └── utils.ts           # General utilities and helpers
├── pages/                 # Next.js pages and API routes
│   ├── api/               # API endpoint implementations
│   │   ├── search.ts      # Main search API
│   │   ├── suggestions.ts # Suggestions API
│   │   ├── pre-render.ts  # Pre-rendering system
│   │   └── client-info.ts # Client information API
│   └── index.tsx          # Main search interface
├── public/                # Static assets and client-side modules
│   ├── js/                # Client-side JavaScript modules
│   │   └── modules/       # Feature-specific modules
│   ├── integration.js     # Main integration script
│   └── SessionService.js  # Session management
└── next.config.js         # Next.js configuration
```

### Development Scripts

```bash
# Development
npm run dev          # Start development server with hot reloading
npm run build        # Build production-ready application
npm run start        # Start production server locally
npm run lint         # Run ESLint for code quality

# Testing and Quality
npm run type-check   # TypeScript type checking
npm run format       # Code formatting with Prettier
```

### Performance Monitoring

#### Client-Side Monitoring

The application includes built-in performance monitoring:

```javascript
// Access performance metrics in browser console
window.getCacheMetrics()     // Cache performance statistics
window.SessionService.getSessionInfo()  // Session management metrics
```

#### Server-Side Monitoring

Monitor API performance through response headers:

- `X-Cache-Status`: Cache hit/miss status
- `X-Client-IP-Source`: IP resolution method
- `X-Cache-TTL`: Cache time-to-live

### Testing Strategy

#### Performance Testing

- Monitor cache hit rates (target: >70% for search results)
- Measure response times (target: <500ms for cache hits)
- Validate session continuity across redirects

#### Feature Testing

- Test search functionality across different browsers
- Verify suggestion accuracy and relevance
- Validate analytics tracking for all user interactions

#### Integration Testing

- Confirm compatibility with main Seattle University website
- Test emergency backup capability
- Verify production deployment process

## Configuration

### Environment Variables

```bash
# Backend Integration
BACKEND_API_URL=https://funnelback-proxy-dev.vercel.app/proxy

# Caching Configuration
KV_URL=redis://username:password@host:port/database
REDIS_URL=redis://username:password@host:port/database

# Logging and Debugging
CACHE_LOG_LEVEL=2          # 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG
API_CLIENT_LOG_LEVEL=2     # Same levels as above
NODE_ENV=development       # development | production

# Optional Performance Tuning
SEARCH_CACHE_TTL=43200     # Default search cache TTL (12 hours)
TAB_CACHE_TTL=50400        # Default tab cache TTL (14 hours)
```

### Client-Side Configuration

The application can be configured through the global `seattleUConfig` object:

```javascript
window.seattleUConfig = {
  search: {
    apiBaseUrl: 'https://su-search-dev.vercel.app',
    proxyBaseUrl: 'https://funnelback-proxy-dev.vercel.app/proxy',
    collection: 'seattleu~sp-search',
    profile: '_default',
    minQueryLength: 3,
    debounceTime: 200,
    enableDebugLogging: false
  }
};
```

## Snapshot Management

### Creating Development Snapshots

Development snapshots serve as milestone markers and deployment checkpoints:

```bash
# Create a feature snapshot
git tag snapshot-dev-feature-name-$(date +%Y%m%d)
git push origin snapshot-dev-feature-name-$(date +%Y%m%d)

# Create a performance optimization snapshot
git tag snapshot-dev-perf-optimization-$(date +%Y%m%d)
git push origin snapshot-dev-perf-optimization-$(date +%Y%m%d)

# View all development snapshots
git tag -l "snapshot-dev-*" | sort -V

# Deploy from a specific snapshot
git checkout snapshot-dev-20250912
vercel --prod
```

### Snapshot Naming Convention

- `snapshot-dev-YYYYMMDD` - Daily development snapshots
- `snapshot-dev-feature-name-YYYYMMDD` - Feature-specific snapshots
- `snapshot-dev-perf-optimization-YYYYMMDD` - Performance improvement snapshots
- `snapshot-dev-security-update-YYYYMMDD` - Security-related updates

## Future Development

### Planned Optimizations

#### 1. Pre-render Performance Enhancement (Next Priority)

**Objective**: Reduce pre-render cache check time from 402ms to <300ms

**Current Status**:

- Cache HIT performance: 424ms total (402ms cache check + 22ms display)
- Cache MISS performance: 1070ms total (746ms cache check + 324ms search)

**Optimization Strategy**:

- Network timing analysis to identify bottlenecks
- Server-side timing instrumentation for cache operations
- Response payload optimization and compression
- Client-side caching layer for repeat queries

**Expected Impact**: 150-200ms improvement in URL parameter search performance

#### 2. Advanced Analytics Dashboard

**Objective**: Visual analytics interface for search behavior analysis

**Planned Features**:

- Real-time search performance metrics
- User interaction heatmaps
- Query popularity and trends analysis
- Cache efficiency monitoring
- Custom reporting capabilities

#### 3. Enhanced Mobile Experience

**Objective**: Optimize search interface for mobile devices

**Planned Improvements**:

- Touch-optimized suggestion interface
- Improved keyboard navigation on mobile
- Faster loading for mobile networks
- Progressive Web App (PWA) capabilities

#### 4. Security Enhancements

**Objective**: Strengthen security posture and data protection

**Planned Improvements**:

- Enhanced input validation and sanitization
- Additional security headers and CORS policies
- Rate limiting for API endpoints
- Improved session security

### Long-term Vision

#### Advanced Search Features

- **Machine Learning Integration**: Query intent analysis and result ranking optimization
- **Personalization**: User-specific search result customization
- **Multi-language Support**: Internationalization for diverse user base
- **Voice Search**: Speech-to-text search capability

#### Performance Excellence

- **Sub-200ms Response Times**: Advanced caching and optimization techniques
- **Edge Computing**: Distributed caching for global performance
- **Real-time Indexing**: Live content updates without reindexing delays

#### Integration Expansion

- **Headless CMS Integration**: Direct content management system connectivity
- **Third-party Services**: Integration with external knowledge bases
- **API Ecosystem**: RESTful API for third-party developer access

## Contributing

### Development Process

1. **Create Feature Branch**:

   ```bash
   git checkout -b feature/amazing-new-feature
   ```

2. **Implement and Test**:
   - Write code following existing patterns and conventions
   - Test thoroughly in development environment
   - Monitor performance impact

3. **Commit Following Conventions** (see Commit Conventions below)

4. **Create Snapshot**:

   ```bash
   git tag snapshot-dev-feature-name-$(date +%Y%m%d)
   git push origin snapshot-dev-feature-name-$(date +%Y%m%d)
   ```

5. **Submit for Review**:

   - Create detailed pull request with performance metrics
   - Include testing instructions and edge case coverage
   - Document any breaking changes or configuration updates

### Commit Conventions

This repository follows **Conventional Commits** specification for clear, structured commit messages that enable automated changelog generation and semantic versioning.

#### Commit Message Format

```bash
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Commit Types

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New feature | `feat(suggestions): add three-column layout for autocomplete` |
| `fix` | Bug fix | `fix(searchNowFunction): resolve cache key mismatch in URL parameters` |
| `perf` | Performance improvement | `perf(cache): reduce pre-render check time from 402ms to 285ms` |
| `refactor` | Code refactoring | `refactor(sessionService): eliminate redundant initialization calls` |
| `docs` | Documentation changes | `docs(readme): update API endpoint documentation` |
| `style` | Code style changes | `style(analytics): fix ESLint warnings in tracking module` |
| `test` | Test additions/changes | `test(search-api): add integration tests for cache scenarios` |
| `chore` | Maintenance tasks | `chore(deps): update Next.js to version 14.2.0` |
| `ci` | CI/CD changes | `ci(vercel): add performance monitoring to deployment` |

#### Scope Guidelines

Use lowercase scope names that represent the affected component:

**API Scopes**:

- `search-api`, `suggestions-api`, `cache-api`, `client-info`

**Client Module Scopes**:

- `sessionService`, `analytics`, `tabs`, `facets`, `pagination`, `collapse`

**Integration Scopes**:

- `integration`, `search-bundle`, `autocomplete`

**Infrastructure Scopes**:

- `cache`, `redis`, `performance`, `deployment`

#### Commit Message Examples

```bash
# Feature additions
feat(pre-render): implement smart background caching for search queries
feat(analytics): add comprehensive click tracking for suggestion items

# Bug fixes
fix(tabs-manager): prevent duplicate event handlers on dynamic content
fix(cache): resolve TTL calculation error for popular queries

# Performance improvements
perf(search-flow): eliminate redundant cache-first fallback (366ms improvement)
perf(sessionService): reduce initialization overhead by 50ms

# Refactoring
refactor(core-search-manager): extract common session ID logic into utility
refactor(integration): simplify URL parameter processing with helper functions

# Documentation
docs(api): add comprehensive endpoint documentation with examples
docs(performance): document optimization results and monitoring guidelines

# Maintenance
chore(snapshot): create milestone tag for SessionService optimization sprint
chore(env): update Redis configuration for production deployment
```

#### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the commit footer:

```bash
feat(search-api): restructure response format for improved performance

BREAKING CHANGE: Search API now returns structured JSON instead of raw HTML.
Update client-side integration scripts to handle new response format.
```

#### Commit Best Practices

1. **Keep commits focused**: One logical change per commit
2. **Use present tense**: "add feature" not "added feature"
3. **Be specific in scope**: Use the actual component/file affected
4. **Include performance metrics**: When relevant, mention timing improvements
5. **Reference issues**: Include issue numbers when applicable

```bash
# Good examples
fix(cache): resolve Redis connection timeout in production environment
perf(search): reduce average response time by 240ms through query optimization
feat(suggestions): implement keyboard navigation for three-column layout

# Avoid these patterns
fix: various bug fixes
update: made some changes
feat: new stuff
```

#### Automated Tools

The repository may use automated tools that depend on conventional commits:

- **Changelog Generation**: Automatic release notes from commit messages
- **Semantic Versioning**: Version bumps based on commit types
- **Release Automation**: Deployment triggers from tagged commits

#### Commit Validation

Consider using tools like `commitlint` to validate commit message format:

```bash
# Install commitlint (optional)
npm install --save-dev @commitlint/cli @commitlint/config-conventional

# Example .commitlintrc.json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "scope-enum": [2, "always", [
      "search-api", "suggestions-api", "cache-api", 
      "sessionService", "analytics", "tabs", "facets",
      "integration", "performance", "deployment"
    ]]
  }
}
```

### Code Quality Standards

- **TypeScript**: Use strict typing for all new code
- **Performance**: Monitor and document performance impact
- **Testing**: Include comprehensive test coverage
- **Documentation**: Update README and inline documentation
- **Analytics**: Ensure proper tracking for new features

### Review Criteria

- **Functionality**: Feature works as designed across browsers
- **Performance**: No degradation in response times or cache efficiency
- **Security**: Proper input validation and error handling
- **Maintainability**: Clean, well-documented, reusable code
- **Integration**: Seamless integration with existing systems

## Troubleshooting

### Common Issues

#### Cache Performance Issues

```bash
# Check cache status and metrics
curl -H "X-Cache-Only: true" "https://su-search-dev.vercel.app/api/search?query=test"

# Monitor cache hit rates in browser console
window.getCacheMetrics()
```

#### Session Management Issues

```bash
# Check session status in browser console
window.SessionService.getSessionInfo()

# Enable debug logging
window.SessionService.setLogLevel(3)
```

#### Performance Debugging

```bash
# Enable search debug logging via URL parameter
https://su-search-dev.vercel.app/search-test/?query=test&debug_search=true

# Monitor network timing in browser DevTools
# Look for X-Cache-Status and X-Client-IP-Source headers
```

### Performance Monitoring Metrics

#### Client-Side Metrics

- Cache hit rates and response times
- Session continuity and IP resolution
- User interaction tracking and analytics

#### Server-Side Metrics

- API endpoint response times
- Cache efficiency and TTL optimization
- Error rates and failure patterns

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support and Contact

### Technical Support

- **Primary Contact**: Seattle University Web Team <web@seattleu.edu>
- **Repository Issues**: [GitHub Issues](https://github.com/vicchimenti/su-search-dev/issues)
- **Documentation**: This README and inline code documentation

### Deployment Support

- **Vercel Dashboard**: [su-search-dev project](https://vercel.com/su-web-ops/su-search-dev)
- **Environment Management**: Contact web team for environment configuration
- **Emergency Procedures**: Contact web team for emergency backup activation

### Development Community

- **Code Reviews**: Submit pull requests for team review
- **Feature Requests**: Use GitHub Issues with feature request template
- **Performance Improvements**: Document optimizations with before/after metrics

---

**Current Repository Status**: Optimized development environment ready for feature development and production deployment  
**Last Updated**: September 2025  
**Version**: 3.0 (Post-SessionService Optimization)  
**Next Milestone**: Pre-render Performance Enhancement (<300ms target)