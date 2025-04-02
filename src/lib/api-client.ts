// src/lib/api-client.ts
import axios from 'axios';

// Default base URL from environment variable
const baseURL = process.env.BACKEND_API_URL || 'https://funnelback-proxy-dev.vercel.app/proxy';

// Create axios instance
const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types for search parameters
interface SearchParams {
  query: string;
  collection?: string;
  profile?: string;
  [key: string]: any;
}

// Types for search response
interface SearchResponse {
  data: any;
  status: number;
}

// Get search results from the backend
export async function getSearchResults(params: SearchParams): Promise<SearchResponse> {
  try {
    const response = await apiClient.get('/funnelback/search', { params });
    return {
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    console.error('Error fetching search results:', error);
    throw error;
  }
}

// Get search suggestions from the backend
export async function getSearchSuggestions(params: SearchParams): Promise<SearchResponse> {
  try {
    const response = await apiClient.get('/funnelback/suggest', { params });
    return {
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    throw error;
  }
}

// Get people search results from the backend
export async function getPeopleResults(params: SearchParams): Promise<SearchResponse> {
  try {
    const response = await apiClient.get('/suggestPeople', { params });
    return {
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    console.error('Error fetching people results:', error);
    throw error;
  }
}

// Get program search results from the backend
export async function getProgramResults(params: SearchParams): Promise<SearchResponse> {
  try {
    const response = await apiClient.get('/suggestPrograms', { params });
    return {
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    console.error('Error fetching program results:', error);
    throw error;
  }
}

export default apiClient;