import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface OnlineStudent {
  id: string;
  username: string;
  email: string;
  isOnline: boolean;
}

export interface PlayRequest {
  id: string;
  from: {
    id: string;
    username: string;
  };
  timeControl: number;
  createdAt: string;
}

export const useOnlineStudents = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<OnlineStudent[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PlayRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOnlineStudents = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/users/online?requesterId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Failed to fetch online students:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchIncomingRequests = async () => {
    if (!user) return;
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/play-requests/incoming/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data.requests);
      }
    } catch (err) {
      console.error('Failed to fetch incoming requests:', err);
    }
  };

  const sendPlayRequest = async (toStudentId: string) => {
    if (!user) return { error: 'Not authenticated' };
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/play-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromStudentId: user.id,
          toStudentId: toStudentId,
          timeControl: 15 // Fixed 15 minutes for student vs student
        })
      });

      if (res.ok) {
        return { success: true };
      } else {
        const data = await res.json();
        return { error: data.error || 'Failed to send request' };
      }
    } catch (err) {
      return { error: 'Network error' };
    }
  };

  const respondToRequest = async (requestId: string, accepted: boolean) => {
    if (!user) return { error: 'Not authenticated' };
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/play-requests/${requestId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accepted,
          responderId: user.id
        })
      });

      if (res.ok) {
        // Remove from incoming requests
        setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
        return { success: true };
      } else {
        const data = await res.json();
        return { error: data.error || 'Failed to respond' };
      }
    } catch (err) {
      return { error: 'Network error' };
    }
  };

  useEffect(() => {
    // initial load (show loader)
    fetchOnlineStudents();
    fetchIncomingRequests();

    // Poll for updates (silent) every 3 seconds so UI updates without visible loaders
    const interval = setInterval(() => {
      fetchOnlineStudents(true);
      fetchIncomingRequests();
    }, 3000);

    return () => clearInterval(interval);
  }, [user]);

  // Listen for socket events
  useEffect(() => {
    const handleNewRequest = (event: any) => {
      fetchIncomingRequests();
    };

    window.addEventListener('app:play-request-received', handleNewRequest);
    return () => window.removeEventListener('app:play-request-received', handleNewRequest);
  }, []);

  // Listen for rejected events for student-to-student requests and notify requester
  useEffect(() => {
    if (!user) return;
    const onRejected = (e: any) => {
      const data = e.detail;
      if (!data) return;
      // Only show the toast to the original requester
      if (String(data.requesterId) === String(user.id)) {
        toast.error(data.message || 'Play request declined');
      }
    };
    window.addEventListener('app:play-request-rejected', onRejected as EventListener);
    return () => window.removeEventListener('app:play-request-rejected', onRejected as EventListener);
  }, [user]);

  return {
    students,
    incomingRequests,
    loading,
    sendPlayRequest,
    respondToRequest,
    refresh: fetchOnlineStudents
  };
};
