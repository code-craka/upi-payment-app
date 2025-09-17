'use client';

import { ClerkProvider as NextClerkProvider } from '@clerk/nextjs';
import { type ReactNode } from 'react';

interface ClerkProviderProps {
  children: ReactNode;
  publishableKey?: string;
  appearance?: Record<string, unknown>;
}

export function ClerkProvider({ children, publishableKey, appearance }: ClerkProviderProps) {
  return (
    <NextClerkProvider publishableKey={publishableKey} appearance={appearance}>
      {children}
    </NextClerkProvider>
  );
}