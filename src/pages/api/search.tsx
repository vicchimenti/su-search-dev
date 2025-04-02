import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // This is just a placeholder response for now
    return res.status(200).json({ 
      status: "ok",
      message: "API is running. Full implementation coming soon." 
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    return res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message 
    });
  }
}