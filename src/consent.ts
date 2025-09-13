export type ConsentState = {
  trackingEnabled: boolean;
};

let currentConsentState: ConsentState = { trackingEnabled: true };

export function enableTracking(): void {
  currentConsentState.trackingEnabled = true;
}

export function disableTracking(): void {
  currentConsentState.trackingEnabled = false;
}

export function isTrackingEnabled(): boolean {
  return currentConsentState.trackingEnabled;
}
