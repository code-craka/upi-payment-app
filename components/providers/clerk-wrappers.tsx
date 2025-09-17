'use client';

import React from 'react';
import { SignedIn as ClerkSignedIn, SignedOut as ClerkSignedOut } from '@clerk/nextjs';

export function SignedIn({ children }: { children: React.ReactNode }) {
  return React.createElement(ClerkSignedIn as React.ComponentType<{ children: React.ReactNode }>, {}, children);
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  return React.createElement(ClerkSignedOut as React.ComponentType<{ children: React.ReactNode }>, {}, children);
}