## expo-plausible example

Minimal Expo component showing how to use `expo-plausible`.

This is a single-file example (`example/App.tsx`) you can drop into an Expo project. No `package.json` or `app.json` is included here per request.

### What it shows
- **Provider setup**: Wraps the app with `PlausibleProvider` using `config={{ domain: 'example.com' }}`.
- **Track an event**: Button triggers `trackEvent('Signup', { props: { plan: 'Pro' } })`.
- **Offline → online queue**: Simulate offline to enqueue events, then restore and flush.

### Usage
1. **Install the library** in your Expo project:
   ```bash
   pnpm add expo-plausible
   # or: npm i expo-plausible  |  yarn add expo-plausible
   ```

2. **Copy** `example/App.tsx` into your own project (e.g. replace your existing `App.tsx`).

3. **Run** your app:
   ```bash
   pnpm expo start
   # or: npx expo start
   ```

### Demo: offline → online queue flush
The example uses the library's built-in offline queue. To see it in action:

1. Press **"Simulate Offline"** to override `fetch` and cause network errors.
2. Press **"Track Signup (Pro)"**.
   - The request fails and the event is queued.
3. Press **"Go Online + Flush Queue"** to restore `fetch` and call `flushQueue()`.
   - Queued events are sent. The status text shows how many were flushed.

Notes:
- The provider defaults `enableOfflineQueue` to `true`, so enqueuing happens automatically on failures.
- For real projects, you can set your own domain via `config={{ domain: 'your-domain.com' }}` and optionally configure `apiHost` or `batch`.


