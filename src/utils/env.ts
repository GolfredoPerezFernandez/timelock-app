/**
 * Environment variable utilities for Qwik application
 * This module provides a consistent way to access environment variables
 * across both client and server code, handling the different formats.
 */

// For client-side (ESM), we can use import.meta.env directly
// For server-side (CommonJS), we'll need to access via different methods

/**
 * Get an environment variable with proper fallback handling
 * Works in both client and server contexts
 */
export function getEnv(key: string, defaultValue: string = ''): string {
  // Check if we're in a browser context
  if (typeof window !== 'undefined') {
    // Client-side: Use import.meta.env for PUBLIC_ variables
    // @ts-ignore - TypeScript doesn't know about import.meta.env by default
    return (import.meta.env && import.meta.env[key]) || defaultValue;
  }
  
  // Server-side: We can't use import.meta.env in CommonJS output
  // This will be accessed via requestEvent.env.get() instead
  return defaultValue;
}

/**
 * Constants for commonly used environment variables
 * These are safe to use in client-side code
 */
export const ENV = {
  // Add your public environment variables here
  API_URL: getEnv('PUBLIC_API_URL', 'http://localhost:3000'),
  // Example hardcoded values for contract addresses that might come from env variables
  TIMELOCK_CONTRACT_ADDRESS: getEnv(
    'PUBLIC_TIMELOCK_CONTRACT',
    '0xa210Fff1cfD0ffBdF4A623682dB2102bef8473D2' // Default fallback value
  ),
  // Token addresses
  TOKEN_ADDRESSES: {
    // USDC token address (for USD)
    USD: getEnv('PUBLIC_USDC_TOKEN', '0x7EA2be2df7BA6E54B1A9C70676f668455E329d29'),
    
    // EUR token address
    EUR: getEnv('PUBLIC_EUR_TOKEN', '0x9dB4B94349CaDE7c4A3985B80c4C3Dd46f3581e1'),
    
    // KNRT token address
    KNRT: getEnv('PUBLIC_KNRT_TOKEN', '0x54de10fadf4ea2fbad10ebfc96979d0885dd36fa')
  }
};

/**
 * Type definition for server environment variables
 * Use this to ensure type safety when accessing server env variables
 */
export type ServerEnv = {
  // Add your server-side environment variables here
  PRIVATE_LIBSQL_DB_URL: string;
  PRIVATE_LIBSQL_DB_API_TOKEN: string;
  TIMELOCK_CONTRACT_ADDRESS: string;
  // Add other private variables as needed
};
