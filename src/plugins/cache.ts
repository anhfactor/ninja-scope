import NodeCache from 'node-cache';

const cache = new NodeCache({ checkperiod: 30 });

let lastGetWasCacheHit = false;

export function getCache<T>(key: string): { data: T; cached: true } | null {
  const value = cache.get<T>(key);
  if (value === undefined) {
    lastGetWasCacheHit = false;
    return null;
  }
  lastGetWasCacheHit = true;
  return { data: value, cached: true };
}

export function setCache<T>(key: string, value: T, ttlSeconds: number): void {
  cache.set(key, value, ttlSeconds);
}

export function wasCacheHit(): boolean {
  return lastGetWasCacheHit;
}

export function getCacheStats() {
  return cache.getStats();
}

export function flushCache(): void {
  cache.flushAll();
}

export { cache };
