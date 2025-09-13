import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button, SafeAreaView, Text, View } from 'react-native';
import { PlausibleProvider, useTrackEvent, flushQueue } from 'expo-plausible';

function Demo(): JSX.Element {
  const trackEvent = useTrackEvent();
  const [isOffline, setIsOffline] = useState(false);
  const [lastStatus, setLastStatus] = useState<string>('');
  const originalFetchRef = useRef<typeof fetch | undefined>();

  const goOffline = useCallback(() => {
    if (isOffline) return;
    originalFetchRef.current = (globalThis as any).fetch as any;
    (globalThis as any).fetch = async () => {
      throw new Error('Simulated offline');
    };
    setIsOffline(true);
    setLastStatus('Offline: network errors will enqueue events');
  }, [isOffline]);

  const goOnlineAndFlush = useCallback(async () => {
    if (!isOffline) return;
    if (originalFetchRef.current) {
      (globalThis as any).fetch = originalFetchRef.current as any;
      originalFetchRef.current = undefined;
    }
    setIsOffline(false);
    const sent = await flushQueue();
    setLastStatus(`Online: flushed ${sent} queued event(s)`);
  }, [isOffline]);

  const onSignup = useCallback(async () => {
    try {
      await trackEvent({
        name: 'Signup',
        url: 'https://example.com/signup',
        props: { plan: 'Pro' },
      });
      setLastStatus('Tracked: Signup (Pro)');
    } catch (e) {
      setLastStatus('Track failed; event may be queued');
    }
  }, [trackEvent]);

  const statusColor = useMemo(() => (isOffline ? '#c2410c' : '#16a34a'), [isOffline]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>expo-plausible example</Text>
        <Text>Domain: example.com</Text>

        <View style={{ height: 12 }} />

        <Button title="Track Signup (Pro)" onPress={onSignup} />

        <View style={{ height: 24 }} />

        <Button title="Simulate Offline" onPress={goOffline} />
        <Button title="Go Online + Flush Queue" onPress={goOnlineAndFlush} />

        <View style={{ height: 24 }} />

        <Text style={{ color: statusColor }}>{isOffline ? 'Status: Offline' : 'Status: Online'}</Text>
        {!!lastStatus && <Text>{lastStatus}</Text>}
      </View>
    </SafeAreaView>
  );
}

export default function App(): JSX.Element {
  return (
    <PlausibleProvider config={{ domain: 'example.com' }}>
      <Demo />
    </PlausibleProvider>
  );
}


