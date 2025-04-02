import Redis from 'ioredis';

// Redis client singleton
let redis: Redis | null = null;

// Get Redis client
function getRedisClient(): Redis {
  if (redis) return redis;
  
  // Updated to use your new environment variable
  const redisUrl = process.env.FRONT_DEV_REDIS_URL;
  
  if (!redisUrl) {
    throw new Error('FRONT_DEV_REDIS_URL environment variable is not defined');
  }
  
  redis = new Redis(redisUrl);
  return redis;
}

// Generate a cache key based on parameters
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  // Filter out session-specific parameters
  const relevantParams = { ...params };
  delete relevantParams.sessionId;
  
  // Sort keys for consistent ordering
  const sortedParams = Object.keys(relevantParams)
    .sort()
    .reduce((acc, key) => {
      acc[key] = relevantParams[key];
      return acc;
    }, {} as Record<string, any>);
  
  // Create cache key
  return `${prefix}:${JSON.stringify(sortedParams)}`;
}

// Cache TTL configuration (in seconds)
export const CACHE_TTL = {
  search: 300,       // 5 minutes for search results
  suggestions: 3600, // 1 hour for suggestions
  enhance: 86400,    // 24 hours for enhancement data
  default: 600       // 10 minutes default
};

// Get data from cache
export async function getCachedData(key: string): Promise<any | null> {
  try {
    const client = getRedisClient();
    const cachedData = await client.get(key);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return null;
  } catch (error) {
    console.error('Redis cache error:', error);
    return null;
  }
}

// Set data in cache with TTL
export async function setCachedData(key: string, data: any, ttl = CACHE_TTL.default): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.set(key, JSON.stringify(data), 'EX', ttl);
    return true;
  } catch (error) {
    console.error('Redis cache set error:', error);
    return false;
  }
}

// Check if caching is enabled
export async function isCachingEnabled(): Promise<boolean> {
  try {
    if (!process.env.FRONT_DEV_REDIS_URL) return false;
    
    const client = getRedisClient();
    const pingResult = await client.ping();
    return pingResult === 'PONG';
  } catch (error) {
    console.error('Redis connectivity check failed:', error);
    return false;
  }
}