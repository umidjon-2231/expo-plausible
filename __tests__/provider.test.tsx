import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlausibleProvider, usePlausible } from '../src';

function ShowConfig() {
  const cfg = usePlausible();
  return (
    <div>
      <span data-testid="domain">{cfg.domain}</span>
      <span data-testid="apiHost">{cfg.apiHost}</span>
      <span data-testid="batch">{String(cfg.batch)}</span>
    </div>
  );
}

describe('PlausibleProvider', () => {
  it('provides config with default apiHost when not specified', () => {
    render(
      <PlausibleProvider config={{ domain: 'example.com' }}>
        <ShowConfig />
      </PlausibleProvider>
    );

    expect(screen.getByTestId('domain').textContent).toBe('example.com');
    expect(screen.getByTestId('apiHost').textContent).toBe('https://plausible.io');
    expect(screen.getByTestId('batch').textContent).toBe('false');
  });

  it('allows nested providers where child overrides parent', () => {
    render(
      <PlausibleProvider config={{ domain: 'parent.com', apiHost: 'https://parent.host', batch: true }}>
        <PlausibleProvider config={{ domain: 'child.com' }}>
          <ShowConfig />
        </PlausibleProvider>
      </PlausibleProvider>
    );

    expect(screen.getByTestId('domain').textContent).toBe('child.com');
    // inherits apiHost from parent since child did not specify apiHost
    expect(screen.getByTestId('apiHost').textContent).toBe('https://parent.host');
    // inherits batch true from parent
    expect(screen.getByTestId('batch').textContent).toBe('true');
  });
});


