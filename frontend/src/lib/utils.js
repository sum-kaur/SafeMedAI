import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * API base URL configuration.
 * - In development: uses REACT_APP_BACKEND_URL env var (default: http://localhost:8000)
 * - In production (Railway): uses BACKEND_URL env var or relative /api/
 */
export function getApiBaseUrl() {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.replace(/\/$/, ''); // Remove trailing slash
  }
  const runtimeUrl = window.__SAFE_MED_CONFIG__?.apiBaseUrl;
  if (runtimeUrl && runtimeUrl.trim() !== '') {
    return runtimeUrl.replace(/\/$/, '');
  }
  // Default for local dev or relative for production
  return window.location.origin === 'http://localhost:3000'
    ? 'http://localhost:8000'
    : '';
}

export function getApiUrl(path) {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
