import { useCallback, useEffect, useState } from 'react';
import { api } from '../config/auth.js';

const POLL_MS = 45_000;

export default function useNotificationUnreadCount(active = true) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setCount(Number(data?.count) || 0);
    } catch {
      /* ignore — menu badge is non-critical */
    }
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('notifications-changed', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('notifications-changed', onFocus);
    };
  }, [active, refresh]);

  return { count, refresh };
}
