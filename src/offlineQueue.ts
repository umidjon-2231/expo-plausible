export type KeyValueAsyncStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type TrackEventBody = {
  name: string;
  url: string;
  domain: string;
  props?: Record<string, string | number | boolean | null>;
};

export type QueuedEvent = {
  endpoint: string;
  body: TrackEventBody;
};

const QUEUE_STORAGE_KEY = '@expo-plausible/queue';

let inMemoryStore: Record<string, string> = {};

function getFallbackStorage(): KeyValueAsyncStorage {
  return {
    async getItem(key: string): Promise<string | null> {
      return Object.prototype.hasOwnProperty.call(inMemoryStore, key) ? inMemoryStore[key] ?? null : null;
    },
    async setItem(key: string, value: string): Promise<void> {
      inMemoryStore[key] = value;
    },
    async removeItem(key: string): Promise<void> {
      delete inMemoryStore[key];
    },
  };
}

let cachedStorage: KeyValueAsyncStorage | null = null;

function resolveStorage(): KeyValueAsyncStorage {
  if (cachedStorage) return cachedStorage;
  // Try to resolve @react-native-async-storage/async-storage at runtime
  try {
    const mod = require('@react-native-async-storage/async-storage');
    // Some builds export default, others export as module
    const storage: any = mod?.default ?? mod;
    if (
      storage &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function' &&
      typeof storage.removeItem === 'function'
    ) {
      cachedStorage = storage as KeyValueAsyncStorage;
      return cachedStorage;
    }
  } catch {
    // ignore resolution error and fall back
  }
  cachedStorage = getFallbackStorage();
  return cachedStorage;
}

export async function enqueueEvent(event: QueuedEvent): Promise<void> {
  const storage = resolveStorage();
  const existing = await storage.getItem(QUEUE_STORAGE_KEY);
  let queue: QueuedEvent[] = [];
  if (existing) {
    try {
      queue = JSON.parse(existing) as QueuedEvent[];
      if (!Array.isArray(queue)) queue = [];
    } catch {
      queue = [];
    }
  }
  queue.push(event);
  await storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

export type FlushOptions = {
  batch?: boolean;
  fetchImpl?: typeof fetch;
};

function isTrackingEnabledSafe(): boolean {
  try {
    // Lazy import to avoid circular deps
    const consent = require('./consent');
    if (consent && typeof consent.isTrackingEnabled === 'function') {
      return !!consent.isTrackingEnabled();
    }
  } catch {}
  return true;
}

export async function flushQueue(options?: FlushOptions): Promise<number> {
  const { batch = false, fetchImpl } = options ?? {};
  const storage = resolveStorage();
  const raw = await storage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) return 0;
  let queue: QueuedEvent[] = [];
  try {
    queue = JSON.parse(raw) as QueuedEvent[];
    if (!Array.isArray(queue)) queue = [];
  } catch {
    queue = [];
  }

  if (queue.length === 0) {
    return 0;
  }

  // If tracking is disabled, drop all queued events
  if (!isTrackingEnabledSafe()) {
    await storage.removeItem(QUEUE_STORAGE_KEY);
    return 0;
  }

  const usedFetch: typeof fetch | undefined = fetchImpl ?? (globalThis as any).fetch;
  if (!usedFetch) {
    // If no fetch available, skip flushing
    return queue.length;
  }

  let successCount = 0;

  if (batch) {
    // Group by endpoint and send arrays of bodies in one request each
    const endpointToBodies: Record<string, TrackEventBody[]> = {};
    for (const item of queue) {
      const list = endpointToBodies[item.endpoint] ?? (endpointToBodies[item.endpoint] = []);
      list.push(item.body);
    }

    const failedEvents: QueuedEvent[] = [];

    for (const endpoint of Object.keys(endpointToBodies)) {
      const bodies = endpointToBodies[endpoint]!;
      try {
        const response: any = await usedFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodies),
        });
        if (!response || !response.ok) {
          // If batch fails, keep all events for that endpoint
          for (const b of bodies) failedEvents.push({ endpoint, body: b });
        } else {
          successCount += bodies.length;
        }
      } catch {
        for (const b of bodies) failedEvents.push({ endpoint, body: b });
      }
    }

    if (failedEvents.length === 0) {
      await storage.removeItem(QUEUE_STORAGE_KEY);
    } else {
      await storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(failedEvents));
    }
  } else {
    const remaining: QueuedEvent[] = [];
    for (const item of queue) {
      try {
        const response: any = await usedFetch(item.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body),
        });
        if (!response || !response.ok) {
          remaining.push(item);
        } else {
          successCount += 1;
        }
      } catch {
        remaining.push(item);
      }
    }

    if (remaining.length === 0) {
      await storage.removeItem(QUEUE_STORAGE_KEY);
    } else {
      await storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
    }
  }

  return successCount;
}

// Test helpers (not exported from public index)
export function __setQueueStorageForTests(storage: KeyValueAsyncStorage | null): void {
  cachedStorage = storage;
  if (cachedStorage === null) {
    inMemoryStore = {};
  }
}

export async function __getStoredQueueForTests(): Promise<QueuedEvent[]> {
  const storage = resolveStorage();
  const raw = await storage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
