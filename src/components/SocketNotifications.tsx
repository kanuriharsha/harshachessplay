import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
// Note: Draw and EndGame modals are handled inside the Game page to avoid
// showing popups globally on non-game routes. This component only shows
// lightweight toasts and re-dispatches global events.

export const SocketNotifications: React.FC = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const [endGameData, setEndGameData] = useState<any>(null);
  const { role } = useAuth();

  useEffect(() => {
    const onGameEnded = (e: any) => {
      setEndGameData(e.detail);
    };
    const onDrawDeclined = () => {
      // Draw decline is relevant only inside game page; show a subtle toast here
      toast.info('Opponent declined the draw');
    };
    const onGameUpdate = (e: any) => {
      // could be used to show subtle notifications or update UIs
      // dispatch as global event for any interested component
      window.dispatchEvent(new CustomEvent('app:game-update-global', { detail: e.detail }));
    };

    // Only subscribe to lightweight global events here
    window.addEventListener('app:draw-declined', onDrawDeclined as EventListener);
    window.addEventListener('app:game-ended', onGameEnded as EventListener);
    window.addEventListener('app:game-update', onGameUpdate as EventListener);

    return () => {
      window.removeEventListener('app:draw-declined', onDrawDeclined as EventListener);
      window.removeEventListener('app:game-ended', onGameEnded as EventListener);
      window.removeEventListener('app:game-update', onGameUpdate as EventListener);
    };
  }, []);

  // draw accept/decline are handled inside the Game page where the modal is mounted

  const handleGoBack = () => {
    // CRITICAL: Clear modal state FIRST, then navigate
    // This ensures single-click behavior and prevents modal from staying mounted
    setEndGameData(null);
    
    // Use setTimeout to ensure state update is flushed before navigation
    setTimeout(() => {
      if (role === 'admin') navigate('/admin');
      else navigate('/student');
    }, 0);
  };

  return null; // no UI here — notifications handled in-page
};

export default SocketNotifications;
