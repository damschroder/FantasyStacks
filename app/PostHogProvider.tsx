'use client';

import posthog from 'posthog-js';
import { PostHogProvider as Provider } from 'posthog-js/react';

const POSTHOG_KEY = 'phc_uTJvqf2NN3Z4Pbf2xoHRErkrnDyceYcNZw5pudtBChqH';
const POSTHOG_HOST = 'https://us.i.posthog.com';

if (typeof window !== 'undefined') {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
  });
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <Provider client={posthog}>{children}</Provider>;
}
