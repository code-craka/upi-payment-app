"use client"

import { useAuth, useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

export default function ClerkTestPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [apiResult, setApiResult] = useState<any>(null);

  useEffect(() => {
    if (isLoaded) {
      // Test the API endpoint
      fetch('/api/test-clerk')
        .then(res => res.json())
        .then(data => setApiResult(data))
        .catch(err => setApiResult({ error: err.message }));
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Clerk Authentication Test</h1>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Clerk Authentication Test</h1>
      
      <div className="space-y-4">
        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Client Status:</h2>
          <p>Loaded: {String(isLoaded)}</p>
          <p>Signed In: {String(isSignedIn)}</p>
          <p>User ID: {user?.id || 'None'}</p>
          <p>Email: {user?.emailAddresses?.[0]?.emailAddress || 'None'}</p>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Server API Test:</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
            {JSON.stringify(apiResult, null, 2)}
          </pre>
        </div>

        <div className="space-x-2">
          {!isSignedIn ? (
            <a href="/sign-in" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Sign In
            </a>
          ) : (
            <div>
              <span className="text-green-600">✓ Authenticated</span>
              <a href="/dashboard" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ml-2">
                Go to Dashboard
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}