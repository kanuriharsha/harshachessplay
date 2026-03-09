import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * useSpectatorSocket - Creates an isolated socket connection for spectating games
 * 
 * This hook creates a separate, independent socket connection that is NOT shared
 * with the user's active game socket. This ensures that spectating a game does not
 * interfere with the admin's own active game.
 * 
 * Key features:
 * - Separate socket instance from SocketContext
 * - Only used for spectating (read-only)
 * - Does not interfere with player socket events
 * - Automatically joins spectator room
 * - Cleans up on unmount
 */
export const useSpectatorSocket = (sessionId: string | null) => {
  const { user, role } = useAuth();
  const socketRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  const eventHandlersRef = useRef<{ [key: string]: (data: any) => void }>({});

  useEffect(() => {
    if (!user || !sessionId) return;

    const WS = import.meta.env.VITE_WS_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
    
    // Create a NEW socket instance specifically for spectating
    const spectatorSocket = io(WS, { 
      transports: ['websocket'],
      // Use a different namespace or query param to distinguish from player socket
      query: {
        spectatorMode: 'true'
      }
    });
    
    socketRef.current = spectatorSocket;

    spectatorSocket.on('connect', () => {
      console.log('[SpectatorSocket] Connected:', spectatorSocket.id);
      setConnected(true);
      
      // Register as spectator
      try {
        spectatorSocket.emit('register', { userId: user.id, role });
      } catch (err) {
        console.error('[SpectatorSocket] Register failed:', err);
      }
      
      // Join the spectator session room
      try {
        spectatorSocket.emit('join-session', { 
          sessionId, 
          role, 
          isSpectator: true 
        });
        console.log('[SpectatorSocket] Joined spectator room:', sessionId);
      } catch (err) {
        console.error('[SpectatorSocket] Failed to join room:', err);
      }
    });

    // Set up event listeners using the registered handlers
    spectatorSocket.on('game-update', (data: any) => {
      if (eventHandlersRef.current['game-update']) {
        eventHandlersRef.current['game-update'](data);
      }
    });

    spectatorSocket.on('draw-request-received', (data: any) => {
      if (eventHandlersRef.current['draw-request-received']) {
        eventHandlersRef.current['draw-request-received'](data);
      }
    });

    spectatorSocket.on('draw-declined', (data: any) => {
      if (eventHandlersRef.current['draw-declined']) {
        eventHandlersRef.current['draw-declined'](data);
      }
    });

    spectatorSocket.on('game-ended', (data: any) => {
      if (eventHandlersRef.current['game-ended']) {
        eventHandlersRef.current['game-ended'](data);
      }
    });

    spectatorSocket.on('session-reattached', (data: any) => {
      if (eventHandlersRef.current['session-reattached']) {
        eventHandlersRef.current['session-reattached'](data);
      }
    });

    spectatorSocket.on('player-offline', (data: any) => {
      if (eventHandlersRef.current['player-offline']) {
        eventHandlersRef.current['player-offline'](data);
      }
    });

    spectatorSocket.on('connect_error', (err: any) => {
      console.error('[SpectatorSocket] Connect error:', err);
    });

    spectatorSocket.on('disconnect', () => {
      console.log('[SpectatorSocket] Disconnected');
      setConnected(false);
    });

    // Cleanup on unmount
    return () => {
      console.log('[SpectatorSocket] Cleaning up');
      spectatorSocket.disconnect();
      socketRef.current = null;
    };
  }, [user, sessionId, role]);

  // Method to register event handlers
  const on = (event: string, handler: (data: any) => void) => {
    eventHandlersRef.current[event] = handler;
  };

  // Method to unregister event handlers
  const off = (event: string) => {
    delete eventHandlersRef.current[event];
  };

  return {
    connected,
    on,
    off,
    socket: socketRef.current,
  };
};
