'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { hasPermission, type PermissionKey } from '@/lib/permissions';

interface User {
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  /** True for SUPER_ADMIN always; for MANAGER, true only if the key is in their granted list. */
  can: (key: PermissionKey) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
  can: () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  }

  useEffect(() => {
    fetchUser();
  }, []);

  // If the session ends while the page is open (signed out elsewhere, account deactivated), any API
  // call comes back 401. Send the person to sign in again instead of leaving them with silent errors.
  useEffect(() => {
    const original = window.fetch;
    let redirecting = false;
    window.fetch = async (...args) => {
      const res = await original(...args);
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
      if (res.status === 401 && !redirecting && /\/api\//.test(url) && !/\/api\/auth\//.test(url)) {
        redirecting = true;
        window.location.href = `/login?expired=1&redirect=${encodeURIComponent(window.location.pathname)}`;
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  const can = (key: PermissionKey) => hasPermission(user, key);

  return (
    <AuthContext.Provider value={{ user, loading, refresh: fetchUser, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}
