# expo-plausible

Plausible Analytics integration for Expo apps. Lightweight provider + hook to send events to the Plausible Events API, with optional offline queueing and batch flushing.

- **Install**: `pnpm add expo-plausible`
- **Provider + hook**: `PlausibleProvider`, `useTrackEvent`
- **Offline ready**: enqueue on failure and flush later
- **Batching**: optionally send queued events in batches
- **Consent helpers**: enable/disable tracking at runtime

## Install

```bash
pnpm add expo-plausible
```

## Quick start

Wrap your app with `PlausibleProvider`, then call `useTrackEvent()` where you need it.

```tsx
import React from 'react';
import { Text, View, Button } from 'react-native';
import { PlausibleProvider, useTrackEvent } from 'expo-plausible';

function Screen(): JSX.Element {
  const trackEvent = useTrackEvent();

  async function onSignup(): Promise<void> {
    await trackEvent({
      name: 'Signup',
      url: 'https://your-app.example/signup',
      props: { plan: 'Pro' },
    });
  }

  return (
    <View>
      <Text>Welcome</Text>
      <Button title="Track Signup" onPress={onSignup} />
    </View>
  );
}

export default function App(): JSX.Element {
  return (
    <PlausibleProvider config={{ domain: 'your-domain.com' }}>
      <Screen />
    </PlausibleProvider>
  );
}
```

## Advanced usage

### Batching

- Set `batch: true` on the provider to enable batch flushing of the offline queue.
- When the queue is flushed with batching enabled, events to the same endpoint are sent as a single POST containing an array of event bodies.

```tsx
import { PlausibleProvider } from 'expo-plausible';

function Root(): JSX.Element {
  return (
    <PlausibleProvider config={{ domain: 'your-domain.com', batch: true }}>
      {/* ... */}
    </PlausibleProvider>
  );
}
```

You can also manually flush at any time:

```ts
import { flushQueue } from 'expo-plausible';

await flushQueue({ batch: true });
```

### Offline queue

- The provider defaults `enableOfflineQueue` to `true`.
- If a network error or non-2xx response occurs when sending an event, the event is persisted and retried later.
- The queue is automatically flushed on mount when `enableOfflineQueue` is true.

Manual control:

```ts
import { flushQueue } from 'expo-plausible';

const sentCount = await flushQueue(); // uses global fetch by default
```

### Consent

You can toggle analytics at runtime. When disabled, new events are dropped and any queued events are cleared on flush.

```ts
import { enableTracking, disableTracking, isTrackingEnabled, flushQueue } from 'expo-plausible';

disableTracking();
console.log(isTrackingEnabled()); // false

// Later, e.g. after user consent
enableTracking();
await flushQueue();
```

## Nested providers

Child providers override only the fields they specify and inherit the rest from parents.

```tsx
import { PlausibleProvider } from 'expo-plausible';

export function App(): JSX.Element {
  return (
    <PlausibleProvider config={{ domain: 'root-domain.com', apiHost: 'https://plausible.io', batch: false }}>
      {/* Child overrides domain but inherits apiHost and batch */}
      <PlausibleProvider config={{ domain: 'child-domain.com' }}>
        {/* screens */}
      </PlausibleProvider>
    </PlausibleProvider>
  );
}
```

## API reference (essentials)

- `PlausibleProvider({ config })`
  - `domain: string` (required)
  - `apiHost?: string` (default `https://plausible.io`)
  - `enableOfflineQueue?: boolean` (default `true`)
  - `batch?: boolean` (default `false`)
- `useTrackEvent()` → `(request) => Promise<void>`
  - `request = { name: string; url: string; domain?: string; props?: Record<string, string | number | boolean | null> }`
- `flushQueue(options?)` → `Promise<number>`
  - `options = { batch?: boolean; fetchImpl?: typeof fetch }`
- `enableTracking()` / `disableTracking()` / `isTrackingEnabled()`

## Plausible Events API docs

See Plausible’s official Events API documentation: `https://plausible.io/docs/events-api`

## Contributing

Contributions are welcome!

- **Issues**: Please open an issue describing the problem or proposal.
- **PRs**: Keep changes focused. Include tests where applicable.
- **Code style**: TypeScript, clear naming, early returns, meaningful error handling.
- **Testing**: Run `pnpm test` and ensure coverage doesn’t regress.
- **Build**: Run `pnpm build` before publishing; CI will verify types and lint.

Local setup:

```bash
pnpm install
pnpm test
pnpm build
```

By contributing, you agree to license your contributions under the MIT License of this repository.

## License

MIT — see `LICENSE` for details.
