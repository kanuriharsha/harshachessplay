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
    // require non-empty trimmed values
    if (!username || !username.trim() || !password || !password.trim()) return { error: 'Username and password required' };

    try {
      const res = await fetch(`${API}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Invalid credentials. Please try again with correct credentials.' }));
        return { error: body.error || 'Invalid credentials. Please try again with correct credentials.' };
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
