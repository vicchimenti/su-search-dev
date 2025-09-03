/**
 * @fileoverview Seattle University Search Results Page with Server-Side Rendering
 * 
 * This page provides instant search results by pre-rendering content on the server
 * before sending it to the client. It integrates seamlessly with the existing 
 * search page structure, SessionService, and JavaScript modules without requiring
 * any changes to the existing backend or client-side functionality.
 * 
 * Architecture:
 * - Server-side rendering via getServerSideProps for instant results display
 * - Minimal component that only handles pre-rendered HTML injection
 * - Full compatibility with existing SessionService and analytics system
 * - Seamless integration with existing client-side search modules
 * - Temporary server session ID for initial API call only
 * - Existing SessionService becomes source of truth once page loads
 * 
 * Features:
 * - Instant search results display (eliminates loading spinners)
 * - SEO-friendly server-rendered content
 * - Error handling with graceful fallback to client-side loading
 * - Maintains all existing page structure and functionality
 * - Compatible with existing CSS, JavaScript, and analytics
 * - Uses existing Funnelback proxy endpoints and parameters
 * 
 * Integration:
 * - Works with existing T4 CMS page templates
 * - Requires only adding action attribute to search forms
 * - No changes needed to existing backend proxy system
 * - No changes needed to existing client-side modules
 * 
 * @license MIT
 * @author Victor Chimenti
 * @version 1.1.0
 * @lastModified 2025-01-15
 * @since 2025-01-15
 */

import { GetServerSidePropsContext } from 'next';

/**
 * Props interface for the SearchPage component
 */
interface SearchPageProps {
  /** Pre-rendered HTML search results from Funnelback proxy */
  initialResults?: string;
  /** The search query string */
  query: string;
  /** Error message if server-side rendering failed */
  error?: string;
}

/**
 * Search Results Page Component
 * 
 * This is a minimal component that only handles injecting pre-rendered search
 * results HTML into the existing page structure. It does not create any HTML
 * containers or duplicate IDs, ensuring full compatibility with existing
 * accessibility and page structure.
 * 
 * The component assumes:
 * - Existing page structure with #results container already present
 * - Existing CSS and JavaScript modules already loaded
 * - SessionService already managing session continuity
 * - Existing analytics and tracking systems already in place
 * 
 * @param props - Component props containing search data
 * @returns Pre-rendered search results HTML for injection
 */
export default function SearchPage({
  initialResults,
  query,
  error
}: SearchPageProps) {

  // Handle error state with formatted HTML
  if (error) {
    return (
      <div 
        dangerouslySetInnerHTML={{ 
          __html: `<div class="search-error"><h3>Error Loading Results</h3><p>${error}</p></div>` 
        }} 
      />
    );
  }

  // Handle success state with pre-rendered results
  if (initialResults) {
    return <div dangerouslySetInnerHTML={{ __html: initialResults }} />;
  }

  // Fallback loading state for client-side takeover
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: `<div class="search-loading"><p>Loading search results...</p></div>` 
      }} 
    />
  );
}

/**
 * Server-Side Props Generation
 * 
 * This function runs on the server before the page is sent to the client.
 * It pre-fetches search results from the existing Funnelback proxy backend
 * using the same endpoints and parameters as the existing API routes.
 * 
 * The function uses a temporary session ID for the server-side API call only.
 * Once the page loads in the browser, the existing SessionService takes over
 * and becomes the single source of truth for session management, maintaining
 * full continuity with the existing analytics and tracking systems.
 * 
 * Error Handling:
 * - Invalid/empty queries: Shows search page with error message
 * - API failures: Gracefully falls back to client-side loading
 * - Network timeouts: 8-second timeout with fallback
 * 
 * @param context - Next.js server-side context containing request data
 * @returns Props for the SearchPage component
 */
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { query } = context.query;

  // Show search page with error if no query provided
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return {
      props: {
        query: '',
        error: 'Please enter a search query to see results.',
        initialResults: null
      }
    };
  }

  try {
    // Generate temporary session ID for server-side API call only
    // This will be replaced by SessionService once the page loads on the client
    const tempServerSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Use existing backend proxy URL from environment variables
    const backendUrl = process.env.BACKEND_API_URL || 'https://funnelback-proxy-dev.vercel.app/proxy';

    // Prepare parameters matching existing API format
    // These parameters match exactly what /api/search.ts sends to the backend
    const searchParams = new URLSearchParams({
      query: query.trim(),
      collection: 'seattleu~sp-search',
      profile: '_default',
      form: 'partial',
      sessionId: tempServerSessionId
    });

    console.log(`[SSR] Fetching results for query: "${query}"`);

    // Call existing Funnelback search endpoint using same path as API routes
    const searchResponse = await fetch(
      `${backendUrl}/funnelback/search?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'text/html',
          // Forward original user agent if available
          ...(context.req.headers['user-agent'] ? { 'User-Agent': context.req.headers['user-agent'] } : {})
        },
        // Add timeout for server-side rendering to prevent hanging
        signal: AbortSignal.timeout(8000)
      }
    );

    // Validate response from backend proxy
    if (!searchResponse.ok) {
      throw new Error(`Search API responded with status: ${searchResponse.status}`);
    }

    // Get the pre-formatted HTML results
    // This HTML is already wrapped in funnelback-search-container-response div
    const searchResults = await searchResponse.text();

    console.log(`[SSR] Successfully fetched results for "${query}"`);

    return {
      props: {
        initialResults: searchResults,
        query: query.trim(),
        // Note: No session ID passed to client - SessionService handles this
      }
    };

  } catch (error) {
    console.error('[SSR] Error fetching search results:', error);

    // Return error state - existing JavaScript will handle client-side retry/loading
    // This ensures graceful degradation if server-side rendering fails
    return {
      props: {
        query: query.trim(),
        error: 'Failed to load initial results.',
        initialResults: null
      }
    };
  }
}