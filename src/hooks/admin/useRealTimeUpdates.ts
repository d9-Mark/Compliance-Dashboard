// Real-time updates hook for admin dashboard
"use client";

import { useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";

interface UseRealTimeUpdatesOptions {
  enabled?: boolean;
  interval?: number; // milliseconds
  onUpdate?: (type: 'tenant' | 'cve' | 'sentinel') => void;
}

export function useRealTimeUpdates({
  enabled = true,
  interval = 30000, // 30 seconds
  onUpdate,
}: UseRealTimeUpdatesOptions = {}) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const utils = api.useUtils();

  const invalidateQueries = useCallback(async () => {
    if (!enabled) return;

    try {
      // Invalidate tenant data
      await utils.tenant.getTenantsByType.invalidate();
      onUpdate?.('tenant');

      // Invalidate CVE stats if available
      if (utils.cveManagement?.getSyncStatistics) {
        await utils.cveManagement.getSyncStatistics.invalidate();
        onUpdate?.('cve');
      }

      // Invalidate SentinelOne diagnostics
      await utils.sentinelOne.getDiagnostics.invalidate();
      onUpdate?.('sentinel');

    } catch (error) {
      console.warn('Failed to invalidate queries:', error);
    }
  }, [enabled, utils, onUpdate]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    // Set up polling interval
    intervalRef.current = setInterval(invalidateQueries, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, invalidateQueries]);

  // Manual refresh function
  const refreshNow = useCallback(() => {
    invalidateQueries();
  }, [invalidateQueries]);

  return {
    refreshNow,
    isEnabled: enabled,
  };
}

// Hook for smart caching based on data freshness
export function useSmartCache() {
  const utils = api.useUtils();

  const getCacheAge = useCallback((queryKey: string) => {
    // Get cache data if available
    const queryClient = utils.client.queryClient;
    const cache = queryClient.getQueryCache();
    const query = cache.find({ queryKey: [queryKey] });
    
    if (query?.state.dataUpdatedAt) {
      return Date.now() - query.state.dataUpdatedAt;
    }
    
    return Infinity;
  }, [utils]);

  const shouldRefresh = useCallback((queryKey: string, maxAge: number = 300000) => {
    return getCacheAge(queryKey) > maxAge;
  }, [getCacheAge]);

  return {
    getCacheAge,
    shouldRefresh,
  };
}

// Hook for progressive data loading
export function useProgressiveLoading() {
  const utils = api.useUtils();

  const preloadData = useCallback(async () => {
    // Preload frequently accessed data
    const preloadPromises = [
      utils.tenant.getTenantsByType.prefetch(),
      utils.sentinelOne.getDiagnostics.prefetch(),
    ];

    // Add CVE preloading if available
    if (utils.cveManagement?.getSyncStatistics) {
      preloadPromises.push(
        utils.cveManagement.getSyncStatistics.prefetch()
      );
    }

    try {
      await Promise.allSettled(preloadPromises);
    } catch (error) {
      console.warn('Some data preloading failed:', error);
    }
  }, [utils]);

  return {
    preloadData,
  };
}