/**
 * useDebounce Hook
 * Debounces a value, useful for search inputs and API calls
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced value
 * 
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState('')
 * const debouncedQuery = useDebounce(searchQuery, 300)
 * 
 * useEffect(() => {
 *   // This will only run after user stops typing for 300ms
 *   fetchResults(debouncedQuery)
 * }, [debouncedQuery])
 * ```
 */
import { useState, useEffect } from 'react'
import { DEBOUNCE_DELAYS } from '@/lib/constants'

export function useDebounce<T>(value: T, delay: number = DEBOUNCE_DELAYS.SEARCH): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

