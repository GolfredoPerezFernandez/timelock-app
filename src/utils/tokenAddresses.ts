/**
 * Token address constants for different currencies
 * Uses environment variables via the ENV utility
 */

import { ENV } from './env';

// Export the token addresses from ENV
export const TOKEN_ADDRESSES = ENV.TOKEN_ADDRESSES;

/**
 * Get token address by currency code
 */
export function getTokenAddress(currency: string): string {
  return TOKEN_ADDRESSES[currency as keyof typeof TOKEN_ADDRESSES] || '';
}
