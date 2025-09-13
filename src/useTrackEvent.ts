import { useCallback } from 'react';
import { usePlausible } from './context';
import { enqueueEvent, TrackEventBody } from './offlineQueue';
import { isTrackingEnabled } from './consent';

export type TrackEventProps = Record<string, string | number | boolean | null>;

export type TrackEventRequest = {
  name: string;
  url: string;
  domain?: string;
  props?: TrackEventProps;
};

/**
 * Hook returning a function to send an event to Plausible Events API.
 * Depends on `usePlausible` for `domain` and `apiHost` configuration.
 */
export function useTrackEvent(): (request: TrackEventRequest) => Promise<void> {
  const { apiHost, domain: defaultDomain, enableOfflineQueue } = usePlausible();

  const track = useCallback(async (request: TrackEventRequest): Promise<void> => {
    // Drop events entirely if tracking disabled
    if (!isTrackingEnabled()) {
      return;
    }

    const endpointBase = (apiHost || '').replace(/\/$/, '');
    const endpoint = `${endpointBase}/api/event`;

    const body: TrackEventBody = {
      name: request.name,
      url: request.url,
      domain: request.domain ?? defaultDomain,
      props: request.props,
    };

    try {
      const response: any = await (globalThis as any).fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response || !response.ok) {
        const status = response?.status ?? 'unknown';
        const statusText = response?.statusText ?? '';
        let errorDetails = '';
        try {
          errorDetails = await response.text();
        } catch {
          // ignore
        }
        const error = new Error(
          `Plausible event failed: ${status} ${statusText}${errorDetails ? ` - ${errorDetails}` : ''}`
        );
        // enqueue on failure if enabled
        if (enableOfflineQueue && isTrackingEnabled()) {
          try {
            await enqueueEvent({ endpoint, body });
          } catch {
            // ignore enqueue errors to not mask original
          }
        }
        throw error;
      }
    } catch (err) {
      // enqueue on network error if enabled
      if (enableOfflineQueue && isTrackingEnabled()) {
        try {
          await enqueueEvent({ endpoint, body });
        } catch {
          // ignore enqueue errors
        }
      }
      console.error('Failed to send Plausible event', err);
      throw err;
    }
  }, [apiHost, defaultDomain, enableOfflineQueue]);

  return track;
}


