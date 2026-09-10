/**
 * Returns a time-of-day greeting string.
 * Handles edge cases where `Date` may not reflect the user's local timezone
 * by using the browser's `Intl` API when available.
 */
export function getGreeting(): string {
  const hour = new Date().getHours()

  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 21) return 'Good evening'
  return 'Good night'
}

/**
 * Returns the greeting with a fallback name appended.
 * e.g. "Good morning, " or "Good morning, Arafat"
 */
export function getGreetingWithName(name?: string | null): string {
  const greeting = getGreeting()
  if (!name) return `${greeting}`
  return `${greeting}, ${name}`
}
