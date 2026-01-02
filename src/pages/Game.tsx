import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useAuth } from '@/contexts/AuthContext';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { PlayerInfo, GameStatus } from '@/components/chess/GameInfo';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Flag, ArrowLeft, Loader2, Handshake } from 'lucide-react';
// socket is handled globally by SocketProvider
import { EndGameModal } from '@/components/chess/EndGameModal';
import { DrawRequestModal } from '@/components/chess/DrawRequestModal';
import { useSocket } from '@/contexts/SocketContext';

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
  adminIsWhite?: boolean;
  gameMode?: 'friendly' | 'serious';
  createdAt: string;
}

const Game: React.FC = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<GameSession | null>(null);
  const [game, setGame] = useState(new Chess());
  const [remoteLastMove, setRemoteLastMove] = useState<{ from: string; to: string } | null>(null);
  const [adminTime, setAdminTime] = useState(600000);
  const [studentTime, setStudentTime] = useState(600000);
  const [prevFen, setPrevFen] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [gameResult, setGameResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [showDrawRequest, setShowDrawRequest] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const socket = useSocket();

  // Fetch active session
  const fetchSession = useCallback(async () => {
    if (!user) return;

    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/sessions/active?userId=${user.id}`);
      if (!res.ok) {
        toast.error('No active game found');
        navigate(role === 'admin' ? '/admin' : '/student');
        return;
      }
      const body = await res.json();
      const sessionData = body.session as GameSession | null;
      if (!sessionData) {
        toast.error('No active game found');
        navigate(role === 'admin' ? '/admin' : '/student');
        return;
      }
      setSession(sessionData);
      // If fen is missing, initialize to starting position
      setGame(new Chess(sessionData.fen ?? undefined));
      setAdminTime(sessionData.adminTimeMs ?? 600000);
      setStudentTime(sessionData.studentTimeMs ?? 600000);
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch session');
      navigate(role === 'admin' ? '/admin' : '/student');
    }
  }, [user, role, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    } else if (!authLoading && user) {
      fetchSession();
    }
  }, [user, authLoading, navigate, fetchSession]);

  // Ensure we join the socket room for this session so we receive events
  useEffect(() => {
    if (session?._id) {
      try {
        socket.joinSession(session._id);
      } catch (err) {
        console.error('Failed to join session via socket', err);
      }
    }
  }, [session?._id, socket]);

  // Global socket events are dispatched as window events by SocketProvider
  useEffect(() => {
    const onGameUpdate = (e: any) => {
      const data = e.detail;
      if (!data) return;
      // If we received a remote move, play move/capture sound for both players.
      if (data.fen) {
        try {
          // Detect captures by comparing piece counts before and after applying FEN
          const prevBoard = game.board();
          const prevCount = prevBoard.flat().filter(Boolean).length;
          const newGameState = new Chess(data.fen);
          const newBoard = newGameState.board();
          const newCount = newBoard.flat().filter(Boolean).length;

          const isCapture = newCount < prevCount;

          // play sounds using same assets as ChessBoard
          try {
            const play = (type: 'move' | 'capture') => {
              const map: Record<string, string> = {
                move: '/sounds/Move.mp3',
                capture: '/sounds/Capture.mp3',
              };
              const src = map[type] || `/sounds/${type}.mp3`;
              const audio = new Audio(src);
              audio.volume = 0.5;
              audio.play().catch(() => {});
            };
            // Only play when this update includes a lastMove (i.e. a move occurred)
            if (data.lastMove) play(isCapture ? 'capture' : 'move');
          } catch (err) {
            // ignore sound errors
          }

          setGame(newGameState);
        } catch (err) {
          // fallback: just set game
          setGame(new Chess(data.fen));
        }
      }
      if (typeof data.adminTimeMs === 'number') setAdminTime(data.adminTimeMs);
      if (typeof data.studentTimeMs === 'number') setStudentTime(data.studentTimeMs);
      setRemoteLastMove(data.lastMove ?? null);

      // If the sender marked this move as check, notify both players
      if (data.isCheck) {
        toast.warning('Check!');
      }
    };

    const onDrawRequest = () => setShowDrawRequest(true);

    const onDrawDeclined = () => toast.info('Opponent declined the draw');

    const onGameEnded = (e: any) => {
      const data = e.detail;
      if (timerRef.current) clearInterval(timerRef.current);
      if (!data) return;
      if (data.result === 'draw') {
        setGameResult('draw');
        setGameStatus('Game drawn');
      } else if (data.result === 'resign') {
        const didIWin = data.winner === role;
        setGameResult(didIWin ? 'win' : 'lose');
        setGameStatus(didIWin ? 'You won by resignation!' : 'Opponent won by resignation');
      } else {
        // Generic handling for checkmate, opponent-left, or explicit winner
        if (data.winner) {
          const didIWin = data.winner === role;
          setGameResult(didIWin ? 'win' : 'lose');
          setGameStatus(didIWin ? 'You won!' : 'You lost!');
        } else {
          // fallback
          setGameResult('lose');
          setGameStatus('Game ended');
        }
      }
    };



    window.addEventListener('app:game-update', onGameUpdate as EventListener);
    window.addEventListener('app:draw-request', onDrawRequest as EventListener);
    window.addEventListener('app:draw-declined', onDrawDeclined as EventListener);
    window.addEventListener('app:game-ended', onGameEnded as EventListener);

    return () => {
      window.removeEventListener('app:game-update', onGameUpdate as EventListener);
      window.removeEventListener('app:draw-request', onDrawRequest as EventListener);
      window.removeEventListener('app:draw-declined', onDrawDeclined as EventListener);
      window.removeEventListener('app:game-ended', onGameEnded as EventListener);
    };
  }, [adminTime, studentTime, role, fetchSession, game]);

  // Polling for game updates
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(async () => {
      try {
        const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
        const res = await fetch(`${API}/sessions/active?userId=${user?.id}`);
        if (res.ok) {
          const body = await res.json();
          const updated = body.session as GameSession | null;
          if (!updated) return;
          if (updated._id && session && updated._id === session._id) {
            setSession(updated);
            setGame(new Chess(updated.fen));
            // Only lower local timers from server values so we don't increase them unexpectedly
            if (typeof updated.adminTimeMs === 'number') {
              setAdminTime((prev) => Math.min(prev, updated.adminTimeMs));
            }
            if (typeof updated.studentTimeMs === 'number') {
              setStudentTime((prev) => Math.min(prev, updated.studentTimeMs));
            }

            if (updated.status === 'completed') {
              if (updated.winner === 'draw') {
                setGameStatus('Game drawn!');
                toast.info('Game ended in a draw');
              } else {
                const winnerText = updated.winner === 'admin' ? 'Coach' : 'Student';
                setGameStatus(`${winnerText} wins!`);
                toast.success(`${winnerText} wins!`);
              }
            } else if (updated.status === 'timeout') {
              const winnerText = updated.winner === 'admin' ? 'Coach' : 'Student';
              setGameStatus(`${winnerText} wins on time!`);
              toast.info(`${winnerText} wins on time!`);
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [session?._id]);

  // Chess clock logic
  useEffect(() => {
    if (!session || session.status !== 'active') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    const adminIsWhite = session.adminIsWhite !== false; // default true
    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      // Get current turn from the game state (not captured closure)
      const currentTurn = game.turn(); // 'w' or 'b'
      const isWhiteTurn = currentTurn === 'w';
      const isAdminTurn = (adminIsWhite && isWhiteTurn) || (!adminIsWhite && !isWhiteTurn);

      if (isAdminTurn) {
        // It's admin's turn - decrement admin time
        setAdminTime((prev) => {
          const newTime = Math.max(0, prev - delta);
          if (newTime === 0 && prev > 0) {
            handleTimeout('student');
          }
          return newTime;
        });
      } else {
        // It's student's turn - decrement student time
        setStudentTime((prev) => {
          const newTime = Math.max(0, prev - delta);
          if (newTime === 0 && prev > 0) {
            handleTimeout('admin');
          }
          return newTime;
        });
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session?.status, game]);

  const handleTimeout = async (winner: 'admin' | 'student') => {
    if (!session) return;
    
    // Clear the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Update local state immediately
    const didIWin = winner === role;
    setGameResult(didIWin ? 'win' : 'lose');
    setGameStatus(didIWin ? 'You won on time!' : 'You lost on time!');
    
    // Show toast notification
    toast.info(didIWin ? 'Opponent ran out of time - You win!' : 'Time\'s up - You lose!');

    // Update server
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      await fetch(`${API}/sessions/${session._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'timeout',
          winner,
          adminTimeMs: adminTime,
          studentTimeMs: studentTime,
        }),
      });
      
      // Emit game-ended via socket
      socket.sendResign(session._id, winner === 'admin' ? 'student' : 'admin');
    } catch (err) {
      console.error('Error updating timeout:', err);
    }
  };

  const handleMove = useCallback(async (from: string, to: string) => {
    if (!session || session.status !== 'active') return false;

    // Validate it's this player's turn based on piece color
    const currentTurn = game.turn(); // 'w' or 'b'
    const adminIsWhite = session.adminIsWhite !== false; // default true
    
    // Determine if it's my turn based on my color
    const myColor = role === 'admin' ? (adminIsWhite ? 'w' : 'b') : (adminIsWhite ? 'b' : 'w');
    const isMyTurn = currentTurn === myColor;

    if (!isMyTurn) {
      toast.error("It's not your turn!");
      return false;
    }

    try {
      // store previous fen to allow undo (friendly mode)
      setPrevFen(game.fen());
      const newGame = new Chess(game.fen());
      const move = newGame.move({ from, to, promotion: 'q' });

      if (!move) return false;

      // Update local state immediately for responsive feel
      setGame(newGame);

      // Update session in database
      let status: 'active' | 'completed' = 'active';
      let winner: 'admin' | 'student' | 'draw' | null = null;

      if (newGame.isCheckmate()) {
        status = 'completed';
        // The player who just moved won. Use the move color (returned by chess.js)
        const adminIsWhite = session.adminIsWhite !== false;
        const movedColor = move ? move.color : (currentTurn === 'w' ? 'b' : 'w');
        winner = movedColor === 'w' ? (adminIsWhite ? 'admin' : 'student') : (adminIsWhite ? 'student' : 'admin');
        const didIWin = winner === role;
        setGameResult(didIWin ? 'win' : 'lose');
        setGameStatus('Checkmate!');
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (newGame.isDraw()) {
        status = 'completed';
        winner = 'draw';
        setGameResult('draw');
        setGameStatus('Game drawn');
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (newGame.isCheck()) {
        toast.warning('Check!');
      }

      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/sessions/${session._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fen: newGame.fen(),
          turn: newGame.turn(),
          adminTimeMs: adminTime,
          studentTimeMs: studentTime,
          status,
          winner,
        }),
      });

      if (!res.ok) {
        console.error('Error updating game');
        // Revert local state
        setGame(new Chess(session.fen));
        return false;
      }

      // Emit real-time update via SocketProvider
      // Include the last move so remote clients can highlight it even when
      // we recreate the board from a FEN (which loses move history).
      socket.sendMove({
        sessionId: session._id,
        fen: newGame.fen(),
        turn: newGame.turn(),
        adminTimeMs: adminTime,
        studentTimeMs: studentTime,
        lastMove: { from: move.from, to: move.to },
        isCheck: newGame.isCheck(),
      });

      // If the game finished (checkmate/draw), notify server to broadcast game-ended
      if (status === 'completed') {
        try {
          socket.sendGameEnded({ sessionId: session._id, result: newGame.isDraw() ? 'draw' : 'checkmate', winner });
        } catch (err) {
          console.error('Failed to send game-ended event', err);
        }
      }

      return true;
    } catch (error) {
      console.error('Move error:', error);
      return false;
    }
  }, [game, session, role, adminTime, studentTime]);

  const handleUndo = useCallback(async () => {
    if (!session || !prevFen) return;
    try {
      setGame(new Chess(prevFen));
      // clear prevFen so repeated undo won't reapply
      setPrevFen(null);
      socket.sendUndo({ sessionId: session._id, fen: prevFen });
    } catch (err) {
      console.error('Undo failed', err);
    }
  }, [session, prevFen, socket]);

  const handleResign = async () => {
    if (!session) return;

    socket.sendResign(session._id, role);

    setGameResult('lose');
    setGameStatus('You resigned');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleRequestDraw = () => {
    if (!session) return;
    socket.sendDrawRequest(session._id, role);
    toast.info('Draw request sent to opponent');
  };

  const handleAcceptDraw = () => {
    if (!session) return;
    socket.respondDraw(session._id, true);
    setShowDrawRequest(false);
    setGameResult('draw');
    setGameStatus('Draw accepted');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleDeclineDraw = () => {
    if (!session) return;
    socket.respondDraw(session._id, false);
    setShowDrawRequest(false);
    toast.info('Draw declined');
  };



  const handleBackToDashboard = () => {
    // CRITICAL: Clear modal state FIRST to ensure single-click close behavior
    setGameResult(null);
    setGameStatus('');
    
    // If game is active, send resign to end it for both players, then navigate
    if (session && session.status === 'active') {
      try {
        socket.sendResign(session._id, role);
      } catch (err) {
        console.error('Error sending resign before navigating back', err);
      }
    }
    
    // Use setTimeout to ensure state updates flush before navigation
    setTimeout(() => {
      navigate(role === 'admin' ? '/admin' : '/student');
    }, 0);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No active game</p>
          <Button onClick={handleBackToDashboard}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const currentTurn = game.turn();
  const isGameActive = session.status === 'active';
  const playerColor = (session?.adminIsWhite ?? true) ? (role === 'admin' ? 'white' : 'black') : (role === 'admin' ? 'black' : 'white');
  const opponentColor = playerColor === 'white' ? 'black' : 'white';
  const isPlayerTurn = (role === 'admin' && currentTurn === (session?.adminIsWhite ? 'w' : 'b')) || (role === 'student' && currentTurn === (session?.adminIsWhite ? 'b' : 'w'));

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6">
      <div className="flex flex-col gap-3 md:gap-4 w-full max-w-2xl mx-auto">
        {/* Opponent info (top) */}
        <PlayerInfo
          name={role === 'admin' ? 'Student' : 'Coach'}
          role={role === 'admin' ? 'student' : 'coach'}
          color={opponentColor}
          timeLeft={Math.floor((role === 'admin' ? studentTime : adminTime) / 1000)}
          isActive={!isPlayerTurn}
        />

        {/* Chess Board - Responsive */}
        <ChessBoard
          game={game}
          onMove={handleMove}
          orientation={playerColor}
          disabled={!isGameActive || !isPlayerTurn}
          lastMove={remoteLastMove}
        />

        {/* Player info (bottom) */}
        <PlayerInfo
          name={role === 'admin' ? 'Coach' : 'Student'}
          role={role === 'admin' ? 'coach' : 'student'}
          color={playerColor}
          timeLeft={Math.floor((role === 'admin' ? adminTime : studentTime) / 1000)}
          isActive={isPlayerTurn}
        />

        {/* Game status */}
        <GameStatus status={gameStatus} turn={currentTurn} />

        {/* Controls - Responsive buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 py-2">
          {isGameActive ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestDraw}
                className="gap-2 w-full sm:w-auto text-sm md:text-base py-5 sm:py-2"
              >
                <Handshake className="w-4 h-4" />
                Request Draw
              </Button>
              {session?.gameMode === 'friendly' && role === 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={!prevFen}
                  className="gap-2 w-full sm:w-auto text-sm md:text-base py-5 sm:py-2"
                >
                  Undo Move
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResign}
                className="gap-2 w-full sm:w-auto text-sm md:text-base py-5 sm:py-2"
              >
                <Flag className="w-4 h-4" />
                Resign
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToDashboard}
              className="gap-2 w-full sm:w-auto text-sm md:text-base py-5 sm:py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          )}
        </div>
      </div>

      {/* Game End Modal */}
      <EndGameModal
        result={gameResult}
        onGoBack={handleBackToDashboard}
      />

      {/* Draw Request Modal */}
      <DrawRequestModal
        isOpen={showDrawRequest}
        onAccept={handleAcceptDraw}
        onDecline={handleDeclineDraw}
      />
    </div>
  );
};

export default Game;
