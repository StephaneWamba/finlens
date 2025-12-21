/**
 * Branded Types for IDs
 * 
 * Prevents mixing different ID types and provides type safety
 */

/**
 * Branded type for User IDs
 */
export type UserId = string & { readonly __brand: 'UserId' };

/**
 * Branded type for Session IDs
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Branded type for Query IDs
 */
export type QueryId = string & { readonly __brand: 'QueryId' };

/**
 * Branded type for Stripe Customer IDs
 */
export type StripeCustomerId = string & { readonly __brand: 'StripeCustomerId' };

/**
 * Branded type for Stripe Subscription IDs
 */
export type StripeSubscriptionId = string & { readonly __brand: 'StripeSubscriptionId' };

/**
 * Type guard: Check if value is a valid UserId
 */
export function isUserId(value: unknown): value is UserId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard: Check if value is a valid SessionId
 */
export function isSessionId(value: unknown): value is SessionId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard: Check if value is a valid QueryId
 */
export function isQueryId(value: unknown): value is QueryId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Create a UserId from a string
 */
export function toUserId(id: string): UserId {
  if (!id || id.length === 0) {
    throw new Error('Invalid UserId: cannot be empty');
  }
  return id as UserId;
}

/**
 * Create a SessionId from a string
 */
export function toSessionId(id: string): SessionId {
  if (!id || id.length === 0) {
    throw new Error('Invalid SessionId: cannot be empty');
  }
  return id as SessionId;
}

/**
 * Create a QueryId from a string
 */
export function toQueryId(id: string): QueryId {
  if (!id || id.length === 0) {
    throw new Error('Invalid QueryId: cannot be empty');
  }
  return id as QueryId;
}




