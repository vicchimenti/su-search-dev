import Head from 'next/head';
import { useState } from 'react';

export default function Home() {
  return (
    <div className="container">
      <Head>
        <title>SU Search API</title>
        <meta name="description" content="Seattle University Search API" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>Seattle University Search API</h1>
        <p>This is the API service for Seattle University search functionality.</p>
        
        <h2>Available Endpoints:</h2>
        <ul>
          <li><code>/api/search</code> - Search results</li>
          <li><code>/api/suggestions</code> - Search suggestions</li>
          <li><code>/api/enhance</code> - Enhancement data</li>
        </ul>
      </main>
    </div>
  );
}