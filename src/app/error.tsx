'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application runtime error caught by error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-neutral-200">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-neutral-900">Something went wrong</h2>
          <p className="text-sm text-neutral-600">
            An unexpected error occurred while loading this page. You can try reloading or returning to the dashboard.
          </p>
          {error.message && (
            <p className="text-xs font-mono text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button onClick={() => reset()} className="w-full sm:w-auto flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Try Again
          </Button>
          <Link href="/admin" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full flex items-center gap-2">
              <Home className="w-4 h-4" /> Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
