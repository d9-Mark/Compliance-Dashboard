// Performance monitoring component for admin dashboard
"use client";

import { useEffect, useState } from "react";

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  apiResponseTimes: Record<string, number>;
  memoryUsage?: number;
}

export function PerformanceMonitor({ enabled = false }: { enabled?: boolean }) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const startTime = performance.now();

    // Monitor initial load
    const handleLoad = () => {
      const loadTime = performance.now() - startTime;
      setMetrics(prev => ({
        ...prev,
        loadTime,
        renderTime: performance.now() - startTime,
        apiResponseTimes: prev?.apiResponseTimes || {},
      }));
    };

    // Monitor memory usage if available
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => prev ? {
          ...prev,
          memoryUsage: memory.usedJSHeapSize / 1024 / 1024 // MB
        } : null);
      }
    };

    window.addEventListener('load', handleLoad);
    const memoryInterval = setInterval(updateMemoryUsage, 5000);

    return () => {
      window.removeEventListener('load', handleLoad);
      clearInterval(memoryInterval);
    };
  }, [enabled]);

  if (!enabled || !metrics) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <div className="text-xs font-medium text-gray-700 mb-2">Performance</div>
      <div className="space-y-1 text-xs text-gray-600">
        <div>Load: {metrics.loadTime.toFixed(0)}ms</div>
        <div>Render: {metrics.renderTime.toFixed(0)}ms</div>
        {metrics.memoryUsage && (
          <div>Memory: {metrics.memoryUsage.toFixed(1)}MB</div>
        )}
      </div>
    </div>
  );
}

// Hook to track API response times
export function useApiPerformance() {
  const [responseTimes, setResponseTimes] = useState<Record<string, number>>({});

  const trackApiCall = (name: string, startTime: number) => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    setResponseTimes(prev => ({
      ...prev,
      [name]: duration
    }));

    // Log slow API calls
    if (duration > 2000) {
      console.warn(`Slow API call detected: ${name} took ${duration.toFixed(0)}ms`);
    }
  };

  return { responseTimes, trackApiCall };
}