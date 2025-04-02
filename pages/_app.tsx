/**
 * @fileoverview Main Next.js app
 * 
 * This is the main entry point for the Next.js application.
 *
 * @author Victor Chimenti
 * @version 1.0.0
 */

import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}