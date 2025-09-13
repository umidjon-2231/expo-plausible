import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { PlausibleProvider } from '../src';
import { useTrackEvent } from '../src/useTrackEvent';
import { disableTracking, enableTracking } from '../src';

function Harness({ onReady }: { onReady: (track: ReturnType<typeof useTrackEvent>) => void }) {
  const track = useTrackEvent();
  useEffect(() => {
    onReady(track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);
  return null;
}

describe('useTrackEvent', () => {
  const domain = 'example.com';

  beforeEach(() => {
    jest.resetAllMocks();
    enableTracking();
  });

  it('sends an event successfully', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 202, text: jest.fn().mockResolvedValue('') });
    (globalThis as any).fetch = fetchMock;

    let trackFn: ReturnType<typeof useTrackEvent> | undefined;

    render(
      <PlausibleProvider config={{ domain }}>
        <Harness onReady={(fn) => (trackFn = fn)} />
      </PlausibleProvider>
    );

    await waitFor(() => expect(trackFn).toBeDefined());

    await waitFor(async () => {
      await trackFn!({ name: 'Signup', url: 'https://app.example.com/signup', props: { plan: 'pro', value: 1 } });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, options] = (fetchMock as any).mock.calls[0];
    expect(endpoint).toBe('https://plausible.io/api/event');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    const parsed = JSON.parse(options.body as string);
    expect(parsed).toMatchObject({
      name: 'Signup',
      url: 'https://app.example.com/signup',
      domain,
      props: { plan: 'pro', value: 1 },
    });
  });

  it('fails when fetch rejects', async () => {
    const error = new Error('network down');
    (globalThis as any).fetch = jest.fn().mockRejectedValue(error);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    let trackFn: ReturnType<typeof useTrackEvent> | undefined;
    render(
      <PlausibleProvider config={{ domain }}>
        <Harness onReady={(fn) => (trackFn = fn)} />
      </PlausibleProvider>
    );

    await waitFor(() => expect(trackFn).toBeDefined());

    await expect(
      trackFn!({ name: 'Purchase', url: 'https://app.example.com/checkout', props: { total: 99 } })
    ).rejects.toThrow('network down');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('drops events when tracking disabled', async () => {
    // Set up fetch mock that would fail if called
    const fetchMock = jest.fn().mockRejectedValue(new Error('should not be called'));
    ;(globalThis as any).fetch = fetchMock;

    disableTracking();

    let trackFn: ReturnType<typeof useTrackEvent> | undefined;
    render(
      <PlausibleProvider config={{ domain }}>
        <Harness onReady={(fn) => (trackFn = fn)} />
      </PlausibleProvider>
    );

    await waitFor(() => expect(trackFn).toBeDefined());

    await trackFn!({ name: 'Invisible', url: 'https://app.example.com/hidden' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resumes sending after re-enabling tracking', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 202, text: jest.fn().mockResolvedValue('') });
    ;(globalThis as any).fetch = fetchMock;

    disableTracking();

    let trackFn: ReturnType<typeof useTrackEvent> | undefined;
    render(
      <PlausibleProvider config={{ domain }}>
        <Harness onReady={(fn) => (trackFn = fn)} />
      </PlausibleProvider>
    );
    await waitFor(() => expect(trackFn).toBeDefined());

    await trackFn!({ name: 'NoSend', url: 'https://app.example.com/nosend' });
    expect(fetchMock).not.toHaveBeenCalled();

    enableTracking();

    await trackFn!({ name: 'SendNow', url: 'https://app.example.com/sendnow' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


