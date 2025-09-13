import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { PlausibleProvider } from '../src';
import { useTrackEvent } from '../src/useTrackEvent';
import { flushQueue } from '../src';
import { __getStoredQueueForTests, __setQueueStorageForTests } from '../src/offlineQueue';

function Harness({ onReady }: { onReady: (track: ReturnType<typeof useTrackEvent>) => void }) {
  const track = useTrackEvent();
  useEffect(() => {
    onReady(track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);
  return null;
}

describe('offline queue', () => {
  const domain = 'example.com';

  beforeEach(() => {
    jest.resetAllMocks();
    // reset queue storage to in-memory fallback for isolated tests
    __setQueueStorageForTests(null);
  });

  it('stores event when offline (network failure)', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));

    let trackFn: ReturnType<typeof useTrackEvent> | undefined;
    render(
      <PlausibleProvider config={{ domain }}>
        <Harness onReady={(fn) => (trackFn = fn)} />
      </PlausibleProvider>
    );

    await waitFor(() => expect(trackFn).toBeDefined());

    await expect(
      trackFn!({ name: 'Signup', url: 'https://app.example.com/signup', props: { plan: 'pro' } })
    ).rejects.toThrow('offline');

    const queued = await __getStoredQueueForTests();
    expect(queued.length).toBe(1);
    expect(queued[0].endpoint).toBe('https://plausible.io/api/event');
    expect(queued[0].body).toMatchObject({ name: 'Signup', domain, url: 'https://app.example.com/signup' });
  });

  it('flushes stored events when network is back', async () => {
    // First make the request fail and get queued
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));

    let trackFn: ReturnType<typeof useTrackEvent> | undefined;
    render(
      <PlausibleProvider config={{ domain }}>
        <Harness onReady={(fn) => (trackFn = fn)} />
      </PlausibleProvider>
    );
    await waitFor(() => expect(trackFn).toBeDefined());
    try {
      await trackFn!({ name: 'Purchase', url: 'https://app.example.com/checkout', props: { total: 99 } });
    } catch {}

    let queued = await __getStoredQueueForTests();
    expect(queued.length).toBe(1);

    // Now simulate network back
    (globalThis as any).fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 202, text: jest.fn().mockResolvedValue('') });

    const flushed = await flushQueue();
    expect(flushed).toBe(1);

    queued = await __getStoredQueueForTests();
    expect(queued.length).toBe(0);
  });

  it('does not queue when disable flag is false', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));

    let trackFn: ReturnType<typeof useTrackEvent> | undefined;
    render(
      <PlausibleProvider config={{ domain, enableOfflineQueue: false }}>
        <Harness onReady={(fn) => (trackFn = fn)} />
      </PlausibleProvider>
    );

    await waitFor(() => expect(trackFn).toBeDefined());
    await expect(
      trackFn!({ name: 'Disabled', url: 'https://app.example.com/off', props: { ok: true } })
    ).rejects.toThrow('offline');

    const queued = await __getStoredQueueForTests();
    expect(queued.length).toBe(0);
  });

  it('flushes events in batch mode as a single request per endpoint', async () => {
    // Queue up multiple events to same endpoint
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));

    let trackFn: ReturnType<typeof useTrackEvent> | undefined;
    render(
      <PlausibleProvider config={{ domain }}>
        <Harness onReady={(fn) => (trackFn = fn)} />
      </PlausibleProvider>
    );
    await waitFor(() => expect(trackFn).toBeDefined());

    // Each attempt should be caught so the rest continue
    await trackFn!({ name: 'A', url: 'https://app.example.com/a' }).catch(() => undefined);
    await trackFn!({ name: 'B', url: 'https://app.example.com/b' }).catch(() => undefined);
    await trackFn!({ name: 'C', url: 'https://app.example.com/c' }).catch(() => undefined);

    let queued = await __getStoredQueueForTests();
    expect(queued.length).toBe(3);

    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 202, text: jest.fn().mockResolvedValue('') });
    ;(globalThis as any).fetch = fetchMock;

    const flushed = await flushQueue({ batch: true });
    expect(flushed).toBe(3);

    // One call only, containing array body of 3
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, options] = (fetchMock as any).mock.calls[0];
    expect(endpoint).toBe('https://plausible.io/api/event');
    const bodies = JSON.parse(options.body as string);
    expect(Array.isArray(bodies)).toBe(true);
    expect(bodies.length).toBe(3);

    queued = await __getStoredQueueForTests();
    expect(queued.length).toBe(0);
  });
});
