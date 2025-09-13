import React, { createContext, JSX, ReactNode, useContext, useEffect, useMemo } from 'react';
import { flushQueue } from './offlineQueue';

export type PlausibleConfig = {
  domain: string;
  apiHost?: string;
  enableOfflineQueue?: boolean;
  batch?: boolean;
};

type InternalPlausibleConfig = Required<Omit<PlausibleConfig, 'enableOfflineQueue' | 'batch'>> & { enableOfflineQueue: boolean; batch: boolean };

const DEFAULT_API_HOST = 'https://plausible.io';
const DEFAULT_ENABLE_OFFLINE = true;
const DEFAULT_BATCH = false;

const PlausibleContext = createContext<InternalPlausibleConfig | undefined>(undefined);

export type PlausibleProviderProps = {
  config: PlausibleConfig;
  children: ReactNode;
};

export function PlausibleProvider({ config, children }: PlausibleProviderProps): JSX.Element {
  const parent = useContext(PlausibleContext);

  // Support nested providers: child overrides parent; unspecified child fields inherit from parent
  const value = useMemo<InternalPlausibleConfig>(() => {
    return {
      domain: config.domain,
      apiHost: config.apiHost ?? parent?.apiHost ?? DEFAULT_API_HOST,
      enableOfflineQueue: config.enableOfflineQueue ?? parent?.enableOfflineQueue ?? DEFAULT_ENABLE_OFFLINE,
      batch: config.batch ?? parent?.batch ?? DEFAULT_BATCH,
    };
  }, [config.domain, config.apiHost, config.enableOfflineQueue, config.batch, parent]);

  useEffect(() => {
    if (value.enableOfflineQueue) {
      // Fire and forget queue flush on mount or when toggled on
      void flushQueue({ batch: value.batch });
    }
  }, [value.enableOfflineQueue, value.batch]);

  return <PlausibleContext.Provider value={value}>{children}</PlausibleContext.Provider>;
}

export function usePlausible(): InternalPlausibleConfig {
  const context = useContext(PlausibleContext);
  if (!context) {
    throw new Error('usePlausible must be used within a PlausibleProvider');
  }
  return context;
}


