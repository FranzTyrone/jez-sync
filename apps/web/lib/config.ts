// Get the API base URL from env var or default to localhost
export function getApiUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side: use environment variable
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  // Client-side: use environment variable
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}
