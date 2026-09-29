import { useCallback, useEffect, useState } from 'react';
import { api } from '../config/auth.js';

/** One fetch per full page load; shared across remounts / Strict Mode. */
let cachedCount = 0;
let hasLoaded = false;
let inFlight = null;

function fetchUnreadCount() {
  if (inFlight) return inFlight;
  inFlight = api
    .get('/notifications/unread-count')
    .then(({ data }) => {
      cachedCount = Number(data?.count) || 0;
      hasLoaded = true;
      return cachedCount;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Unread badge count: loads once when the app shell mounts.
 * Refreshes only after `notifications-changed` (e.g. acknowledge).
 */
export default function useNotificationUnreadCount(active = true) {
  const [count, setCount] = useState(() => (hasLoaded ? cachedCount : 0));

  const refresh = useCallback(async (force = false) => {
    if (!force && hasLoaded) {
      setCount(cachedCount);
      return cachedCount;
    }
    try {
      const next = await fetchUnreadCount();
      setCount(next);
      return next;
    } catch {
      /* badge is non-critical */
      return cachedCount;
    }
  }, []);

  useEffect(() => {
    if (!active) return undefined;

    if (hasLoaded) {
      setCount(cachedCount);
    } else {
      refresh(false);
    }

    const onChanged = () => {
      hasLoaded = false;
      refresh(true);
    };
    window.addEventListener('notifications-changed', onChanged);
    return () => window.removeEventListener('notifications-changed', onChanged);
  }, [active, refresh]);

  return { count, refresh: () => refresh(true) };
}
