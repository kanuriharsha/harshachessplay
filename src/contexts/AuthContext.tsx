import React, { createContext, useContext, useState, useEffect } from 'react';

type AppUser = {
  id: string;
  email: string;
  username?: string;
  role: 'admin' | 'student' | null;
};

type UserRole = 'admin' | 'student' | null;

interface AuthContextType {
  user: AppUser | null;
  role: UserRole;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(false);

  const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

  const signIn = async (username: string, password: string): Promise<{ error: string | null }> => {
    if (!username || !password) return { error: 'Username and password required' };

    try {
      const res = await fetch(`${API}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        // Attempt to create a new user with that username (no email by default)
        const signUpRes = await fetch(`${API}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!signUpRes.ok) {
          const body = await signUpRes.json().catch(() => ({ error: 'Signup failed' }));
          return { error: body.error || 'Signup failed' };
        }

        const signInRes = await fetch(`${API}/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!signInRes.ok) {
          const body = await signInRes.json().catch(() => ({ error: 'Signin failed' }));
          return { error: body.error || 'Signin failed' };
        }

        const data = await signInRes.json();
        setUser({ id: data.user.id, email: data.user.email, username: data.user.username, role: data.user.role });
        setRole(data.user.role ?? null);
        return { error: null };
      }

      const data = await res.json();
      setUser({ id: data.user.id, email: data.user.email, username: data.user.username, role: data.user.role });
      setRole(data.user.role ?? null);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Network error' };
    }
  };

  const signOut = async () => {
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
