import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

interface SocketContextType {
  sendDrawRequest: (sessionId: string, fromRole: string) => void;
  respondDraw: (sessionId: string, accepted: boolean) => void;
  sendMove: (payload: any) => void;
  sendUndo: (payload: any) => void;
  joinSession: (sessionId: string, isSpectator?: boolean) => void;
  sendResign: (sessionId: string, resignerRole: string) => void;
  sendGameEnded?: (payload: any) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const socketRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    const WS = import.meta.env.VITE_WS_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
    const socket = io(WS, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SOCKET] Socket connected', socket.id);
      setConnected(true);
      // Register this socket with the server so it can receive user-specific events
      try {
        socket.emit('register', { userId: user.id, role });
        console.log('[SOCKET] Registered with server:', { userId: user.id, role });
      } catch (err) {
        console.error('Socket register emit failed', err);
      }
      // Try to join active session room if exists
      (async () => {
        try {
          // ask server for any active session for THIS user so we don't join others'
          const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
          const res = await fetch(`${API}/sessions/active?userId=${user.id}`);
          if (res.ok) {
            const body = await res.json();
            const sessionId = body.session?._id;
            if (sessionId) {
              socket.emit('join-session', { sessionId, role });
              console.log('Joined active session room from SocketProvider', sessionId, 'role=', role);
            }
          }
        } catch (err) {
          console.error('SocketProvider: failed to fetch active session', err);
        }
      })();
    });

    socket.on('game-update', (data: any) => {
      console.log('[SOCKET] Received game-update:', { sessionId: data.sessionId, fen: data.fen?.substring(0, 30) });
      window.dispatchEvent(new CustomEvent('app:game-update', { detail: data }));
    });

    socket.on('draw-request-received', (data: any) => {
      window.dispatchEvent(new CustomEvent('app:draw-request', { detail: data }));
    });

    socket.on('request-rejected', (data: any) => {
      window.dispatchEvent(new CustomEvent('app:request-rejected', { detail: data }));
    });

    socket.on('session-created', (data: any) => {
      try {
        // Auto-join the session room immediately and notify the app
        if (data && data.sessionId) {
          socket.emit('join-session', { sessionId: data.sessionId, role });
          window.dispatchEvent(new CustomEvent('app:session-created', { detail: data }));
        }
      } catch (err) {
        console.error('Error handling session-created', err);
      }
    });

    socket.on('session-reattached', (data: any) => {
      try {
        console.log('Session reattached:', data);
        window.dispatchEvent(new CustomEvent('app:session-reattached', { detail: data }));
      } catch (err) {
        console.error('Error handling session-reattached', err);
      }
    });

    socket.on('player-offline', (data: any) => {
      try {
        console.log('Player went offline:', data);
        window.dispatchEvent(new CustomEvent('app:player-offline', { detail: data }));
      } catch (err) {
        console.error('Error handling player-offline', err);
      }
    });

    socket.on('draw-declined', () => {
      window.dispatchEvent(new CustomEvent('app:draw-declined'));
    });

    socket.on('game-ended', (data: any) => {
      window.dispatchEvent(new CustomEvent('app:game-ended', { detail: data }));
    });

    socket.on('play-request-received', (data: any) => {
      window.dispatchEvent(new CustomEvent('app:play-request-received', { detail: data }));
    });

    socket.on('play-request-rejected', (data: any) => {
      window.dispatchEvent(new CustomEvent('app:play-request-rejected', { detail: data }));
    });

    socket.on('game-transferred-out', (data: any) => {
      console.log('Game transferred out:', data);
      window.dispatchEvent(new CustomEvent('app:game-transferred-out', { detail: data }));
    });

    socket.on('game-transferred-in', (data: any) => {
      console.log('Game transferred in:', data);
      // Auto-join the transferred session room
      if (data && data.sessionId) {
        socket.emit('join-session', { sessionId: data.sessionId, role });
      }
      window.dispatchEvent(new CustomEvent('app:game-transferred-in', { detail: data }));
    });

    socket.on('player-transferred', (data: any) => {
      console.log('Player transferred:', data);
      window.dispatchEvent(new CustomEvent('app:player-transferred', { detail: data }));
    });

    socket.on('connect_error', (err: any) => {
      console.error('Socket connect_error', err);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const sendDrawRequest = (sessionId: string, fromRole: string) => {
    if (!socketRef.current) {
      console.error('[SOCKET] Cannot send draw request - socket not connected');
      return;
    }
    console.log('[SOCKET] Sending draw request:', { sessionId, fromRole });
    socketRef.current.emit('draw-request', { sessionId, fromRole });
  };

  const respondDraw = (sessionId: string, accepted: boolean) => {
    socketRef.current?.emit('draw-response', { sessionId, accepted });
  };

  const sendMove = (payload: any) => {
    console.log('[SOCKET] Sending move:', { sessionId: payload.sessionId, fen: payload.fen?.substring(0, 30) });
    socketRef.current?.emit('move', payload);
  };

  const sendUndo = (payload: any) => {
    socketRef.current?.emit('undo', payload);
  };

  const joinSession = (sessionId: string, isSpectator = false) => {
    socketRef.current?.emit('join-session', { sessionId, role, isSpectator });
    console.log('SocketProvider: joinSession emitted', sessionId, 'role=', role, 'isSpectator=', isSpectator);
  };



  const sendResign = (sessionId: string, resignerRole: string) => {
    // support either (sessionId, resignerRole) or single object { sessionId, resignerRole }
    if (!socketRef.current) {
      console.error('[SOCKET] Cannot send resign - socket not connected');
      return;
    }
    
    console.log('[SOCKET] Sending resign:', { sessionId, resignerRole });
    if (typeof sessionId === 'object' && sessionId !== null) {
      socketRef.current.emit('resign', sessionId);
    } else {
      socketRef.current.emit('resign', { sessionId, resignerRole });
    }
  };

  const sendGameEnded = (payload: any) => {
    socketRef.current?.emit('game-ended', payload);
  };

  return (
    <SocketContext.Provider value={{ sendDrawRequest, respondDraw, sendMove, sendUndo, joinSession, sendResign, sendGameEnded }}>
      {children}
    </SocketContext.Provider>
  );
};
