import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface GameRequest {
  _id: string;
  studentId: string;
  status: 'pending' | 'accepted' | 'rejected';
  timeControl: number | null;
  createdAt: string;
  updatedAt: string;
}

interface GameSession {
  _id: string;
  adminId: string;
  studentId: string;
  fen: string;
  turn: 'w' | 'b';
  adminTimeMs: number;
  studentTimeMs: number;
  lastMoveAt: string | null;
  status: 'active' | 'completed' | 'timeout' | 'paused';
  winner: 'admin' | 'student' | 'draw' | null;
  gameMode?: 'friendly' | 'serious';
  createdAt: string;
}

export const useGameRequests = () => {
  const { user, role } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<GameRequest[]>([]);
  const [myRequest, setMyRequest] = useState<GameRequest | null>(null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const prevMyRequestId = useRef<string | null>(null);
  const lastActionWasCancel = useRef(false);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      // Students should only fetch their own requests; admins fetch pending
      const url = role === 'student' ? `${API}/requests?userId=${user.id}` : `${API}/requests`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch requests');
      const body = await res.json();
      if (role === 'admin') {
        setPendingRequests(body.requests as GameRequest[]);
      } else if (role === 'student') {
        const newReq = body.requests && body.requests.length > 0 ? (body.requests[0] as GameRequest) : null;
        // Update local request state. Rejections are handled via real-time socket
        // `app:request-rejected` events, so do not assume disappearance means rejection.
        setMyRequest(newReq);
        prevMyRequestId.current = newReq ? newReq._id : null;
      }
    } catch (err) {
      console.error('Fetch requests error:', err);
    }

    setLoading(false);
  }, [user, role]);

  const fetchActiveSession = useCallback(async () => {
    if (!user) return;

    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/sessions/active?userId=${user.id}`);
      if (res.ok) {
        const body = await res.json();
        setActiveSession(body.session as GameSession);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Fetch active session error:', err);
      setActiveSession(null);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
    fetchActiveSession();
  }, [fetchRequests, fetchActiveSession]);

  // Polling for changes is used instead of realtime for the new backend
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchRequests();
      fetchActiveSession();
    }, 3000);
    return () => clearInterval(interval);
  }, [user, role, fetchRequests, fetchActiveSession]);

  // Polling for updates
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchRequests();
      fetchActiveSession();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [user, fetchRequests, fetchActiveSession]);

  // Listen for real-time rejection events and clear the local request immediately
  useEffect(() => {
    if (!user) return;
    const onRejected = (e: any) => {
      const data = e.detail;
      if (!data) return;
      // If this rejection is for the current student, clear and notify
      if (data && data.requestId && myRequest && String(myRequest._id) === String(data.requestId)) {
        setMyRequest(null);
        toast.error(data.message || 'Admin declined to play with you');
      }
    };
    window.addEventListener('app:request-rejected', onRejected as EventListener);
    return () => window.removeEventListener('app:request-rejected', onRejected as EventListener);
  }, [user, myRequest]);

  const sendRequest = async () => {
    if (!user) return { error: 'Not authenticated' };
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: user.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        return { error: body.error || 'Request failed' };
      }
      fetchRequests();
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Network error' };
    }
  };

  const cancelRequest = async () => {
    if (!user || !myRequest) return { error: 'No request to cancel' };
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/requests/${myRequest._id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Delete failed' }));
        return { error: body.error || 'Delete failed' };
      }
      // Mark that the last action was a user-initiated cancel so the polling
      // logic doesn't show a 'declined' toast when the request disappears.
      lastActionWasCancel.current = true;
      setMyRequest(null);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Network error' };
    }
  };

  const acceptRequest = async (requestId: string, timeControl: number, adminIsWhite: boolean = true, gameMode: 'friendly' | 'serious' = 'serious') => {
    if (!user || role !== 'admin') return { error: 'Not authorized' };
    const token = localStorage.getItem('chessplay_token');
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'accepted', timeControl, adminIsWhite, gameMode, adminId: user.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Update failed' }));
        return { error: body.error || 'Update failed' };
      }
      fetchRequests();
      fetchActiveSession();
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Network error' };
    }
  };

  const rejectRequest = async (requestId: string) => {
    if (!user || role !== 'admin') return { error: 'Not authorized' };
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Update failed' }));
        return { error: body.error || 'Update failed' };
      }
      fetchRequests();
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Network error' };
    }
  };

  return {
    pendingRequests,
    myRequest,
    activeSession,
    loading,
    sendRequest,
    cancelRequest,
    acceptRequest,
    rejectRequest,
    refreshSession: fetchActiveSession,
  };
};
