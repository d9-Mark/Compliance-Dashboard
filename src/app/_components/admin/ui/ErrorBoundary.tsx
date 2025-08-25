// Enhanced Error Boundary for Admin Dashboard
"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Admin Dashboard Error:", error, errorInfo);
    
    // Log to monitoring service in production
    if (process.env.NODE_ENV === "production") {
      // Add your error monitoring service here
      console.error("Error logged to monitoring service:", error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return (
          <this.props.fallback
            error={this.state.error!}
            resetErrorBoundary={() => this.setState({ hasError: false, error: undefined })}
          />
        );
      }

      return <DefaultErrorFallback error={this.state.error!} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-red-400">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Dashboard Error
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>Something went wrong while loading the dashboard.</p>
              <p className="mt-1 font-mono text-xs">{error.message}</p>
            </div>
            <div className="mt-4 flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Reload Page
              </button>
              <button
                onClick={() => window.history.back()}
                className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ErrorBoundary, DefaultErrorFallback };