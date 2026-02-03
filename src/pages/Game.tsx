import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  player1TimeMs?: number;
  player2TimeMs?: number;
  lastMoveAt: string | null;
  status: 'active' | 'completed' | 'timeout' | 'paused';
  winner: 'admin' | 'student' | 'draw' | 'player1' | 'player2' | null;
  adminIsWhite?: boolean;
  gameMode?: 'friendly' | 'serious';
  createdAt: string;
  // Student vs Student game properties
  player1Id?: string;
  player2Id?: string;
  player1IsWhite?: boolean;
  player1Name?: string;
  player2Name?: string;
  adminName?: string;
  studentName?: string;
  winnerId?: string;
}

const Game: React.FC = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<GameSession | null>(null);
  const [game, setGame] = useState(new Chess());
  const [remoteLastMove, setRemoteLastMove] = useState<{ from: string; to: string } | null>(null);
  const [adminTime, setAdminTime] = useState(600000);
  const [studentTime, setStudentTime] = useState(600000);
  const [player1Time, setPlayer1Time] = useState(600000);
  const [player2Time, setPlayer2Time] = useState(600000);
  const [prevFen, setPrevFen] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [isSpectator, setIsSpectator] = useState(false);
  const [gameResult, setGameResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [gameEndDetails, setGameEndDetails] = useState<{ reason?: string; status?: string }>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDrawRequest, setShowDrawRequest] = useState(false);
  
  // Board snapshot history for simple undo in friendly matches
  const [boardSnapshots, setBoardSnapshots] = useState<string[]>([]); // Array of FEN strings
  const [canUndo, setCanUndo] = useState(false);
  
  // Track last applied move to prevent double application
  const lastAppliedMoveRef = useRef<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const socket = useSocket();

  // Fetch active session
  const fetchSession = useCallback(async () => {
    if (!user) return;
    // If admin navigated to /game?spectate=SESSION_ID, fetch that session by id
    const params = new URLSearchParams(location.search);
    const spectateId = params.get('spectate');

    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      let res;
      let body;
      let sessionData: GameSession | null = null;
      if (spectateId) {
        // Admin requested spectate of specific session
        res = await fetch(`${API}/sessions/${spectateId}`);
        if (res.ok) {
          body = await res.json();
          sessionData = body.session as GameSession | null;
          setIsSpectator(true);
        }
      } else {
        res = await fetch(`${API}/sessions/active?userId=${user.id}`);
        if (res.ok) {
          body = await res.json();
          sessionData = body.session as GameSession | null;
        }
      }

      if (!res || !res.ok || !sessionData) {
        toast.error('No active game found');
        navigate(role === 'admin' ? '/admin' : '/student');
        return;
      }
      setSession(sessionData);
      // If fen is missing, initialize to starting position
      setGame(new Chess(sessionData.fen ?? undefined));
      setAdminTime(sessionData.adminTimeMs ?? 600000);
      setStudentTime(sessionData.studentTimeMs ?? 600000);
      setPlayer1Time(sessionData.player1TimeMs ?? 600000);
      setPlayer2Time(sessionData.player2TimeMs ?? 600000);
      
      // Initialize board snapshots for friendly matches
      if (sessionData.gameMode === 'friendly') {
        const currentFen = sessionData.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        setBoardSnapshots([currentFen]); // Start with current position
        setCanUndo(false); // Can't undo from initial position
      } else {
        setBoardSnapshots([]);
        setCanUndo(false);
      }
      
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
        socket.joinSession(session._id, isSpectator);
      } catch (err) {
        console.error('Failed to join session via socket', err);
      }
    }
  }, [session?._id, socket, isSpectator]);

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
        
        // Save board snapshot for friendly matches when a move occurred
        if (session?.gameMode === 'friendly' && data.lastMove) {
          setBoardSnapshots(prev => {
            const newSnapshots = [...prev, data.fen];
            setCanUndo(newSnapshots.length > 1); // Enable undo if we have more than initial position
            return newSnapshots;
          });
        }
        } catch (err) {
          // fallback: just set game
          setGame(new Chess(data.fen));
        }
      }
      if (typeof data.adminTimeMs === 'number') setAdminTime(data.adminTimeMs);
      if (typeof data.studentTimeMs === 'number') setStudentTime(data.studentTimeMs);
      if (typeof data.player1TimeMs === 'number') setPlayer1Time(data.player1TimeMs);
      if (typeof data.player2TimeMs === 'number') setPlayer2Time(data.player2TimeMs);
      setRemoteLastMove(data.lastMove ?? null);

      // If the sender marked this move as check, notify both players
      if (data.isCheck) {
        toast.warning('Check!');
      }
    };

    const onDrawRequest = () => setShowDrawRequest(true);

    const onDrawDeclined = () => toast.info('Opponent declined the draw');

    const endHandledRef = (window as any).__endHandledRef || { current: {} };
    (window as any).__endHandledRef = endHandledRef;

    const onGameEnded = (e: any) => {
      const data = e.detail;
      if (!data || !data.sessionId) return;
      // prevent duplicate handling for same session
      if (endHandledRef.current[data.sessionId]) return;
      endHandledRef.current[data.sessionId] = true;

      if (timerRef.current) clearInterval(timerRef.current);

      // Determine didIWin using authoritative payload fields
      const winnerId = data.winnerId || null;
      const player1Id = data.player1Id || data.player1Id;
      const player2Id = data.player2Id || data.player2Id;
      const adminId = data.adminId || data.adminId;
      const studentId = data.studentId || data.studentId;

      let didIWin = false;
      if (winnerId) {
        didIWin = winnerId === user?.id;
      } else if (data.winner) {
        // winner may be a role string
        if (data.winner === 'admin' && adminId) didIWin = adminId === user?.id;
        else if (data.winner === 'student' && studentId) didIWin = studentId === user?.id;
        else if (data.winner === 'player1' && player1Id) didIWin = player1Id === user?.id;
        else if (data.winner === 'player2' && player2Id) didIWin = player2Id === user?.id;
        else didIWin = false;
      }

      if (data.result === 'draw') {
        setGameResult('draw');
        setGameStatus('Game drawn');
        setGameEndDetails({ reason: 'draw', status: 'Game drawn' });
        setIsAnalyzing(false); // Reset analyze mode when new game ends
        // Clear board snapshots when game ends
        setBoardSnapshots([]);
        setCanUndo(false);
      } else {
        setGameResult(didIWin ? 'win' : 'lose');
        let status = '';
        let reason = '';
        if (data.result === 'timeout') {
          status = didIWin ? 'You won on time!' : 'You lost on time!';
          reason = 'timeout';
        } else if (data.result === 'resign') {
          status = didIWin ? 'You won by resignation!' : 'Opponent won by resignation';
          reason = 'resign';
        } else {
          status = didIWin ? 'You won!' : 'You lost!';
          reason = 'checkmate';
        }
        setGameStatus(status);
        setGameEndDetails({ reason, status });
        setIsAnalyzing(false); // Reset analyze mode when new game ends
        // Clear board snapshots when game ends
        setBoardSnapshots([]);
        setCanUndo(false);
      }
    };

    const onSessionReattached = (e: any) => {
      const data = e.detail;
      if (!data || !data.session) return;
      console.log('Reattached to session:', data);
      
      // Update session state with authoritative server state
      setSession(data.session);
      
      // Update chess game state
      const newGame = new Chess(data.session.fen);
      setGame(newGame);
      
      // Update timers with server values
      if (data.session.player1TimeMs !== undefined) setPlayer1Time(data.session.player1TimeMs);
      if (data.session.player2TimeMs !== undefined) setPlayer2Time(data.session.player2TimeMs);
      if (data.session.adminTimeMs !== undefined) setAdminTime(data.session.adminTimeMs);
      if (data.session.studentTimeMs !== undefined) setStudentTime(data.session.studentTimeMs);
      
      // Resume timer if game is still active
      if (data.session.status === 'active') {
        if (timerRef.current) clearInterval(timerRef.current);
        // Timer will be restarted by the useEffect dependency on session.status
      }
      
      toast.success('Reconnected to game!');
    };

    const onPlayerOffline = (e: any) => {
      const data = e.detail;
      if (!data) return;
      
      // Show subtle notification that opponent went offline
      // Don't end the game - just notify
      toast.info(`Player went offline. Game continues...`, {
        duration: 3000,
      });
    };



    window.addEventListener('app:game-update', onGameUpdate as EventListener);
    window.addEventListener('app:draw-request', onDrawRequest as EventListener);
    window.addEventListener('app:draw-declined', onDrawDeclined as EventListener);
    window.addEventListener('app:game-ended', onGameEnded as EventListener);
    window.addEventListener('app:session-reattached', onSessionReattached as EventListener);
    window.addEventListener('app:player-offline', onPlayerOffline as EventListener);

    return () => {
      window.removeEventListener('app:game-update', onGameUpdate as EventListener);
      window.removeEventListener('app:draw-request', onDrawRequest as EventListener);
      window.removeEventListener('app:draw-declined', onDrawDeclined as EventListener);
      window.removeEventListener('app:game-ended', onGameEnded as EventListener);
      window.removeEventListener('app:session-reattached', onSessionReattached as EventListener);
      window.removeEventListener('app:player-offline', onPlayerOffline as EventListener);
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
            if (typeof updated.player1TimeMs === 'number') {
              setPlayer1Time((prev) => Math.min(prev, updated.player1TimeMs));
            }
            if (typeof updated.player2TimeMs === 'number') {
              setPlayer2Time((prev) => Math.min(prev, updated.player2TimeMs));
            }
            
            if (updated.status === 'completed') {
              if (updated.winner === 'draw') {
                setGameStatus('Game drawn!');
                toast.info('Game ended in a draw');
              } else {
                // Determine winner text for admin-student or student-student
                let winnerText = 'Opponent';
                if (updated.winner === 'admin') winnerText = 'Coach';
                else if (updated.winner === 'student') winnerText = 'Student';
                else if (updated.winner === 'player1') winnerText = updated.player1Name || 'Player 1';
                else if (updated.winner === 'player2') winnerText = updated.player2Name || 'Player 2';
                else if (updated.winnerId) winnerText = (updated.winnerId === updated.player1Id ? (updated.player1Name || 'Player 1') : (updated.player2Name || 'Player 2'));
                setGameStatus(`${winnerText} wins!`);
                toast.success(`${winnerText} wins!`);
              }
            } else if (updated.status === 'timeout') {
              let winnerText = 'Opponent';
              if (updated.winner === 'admin') winnerText = 'Coach';
              else if (updated.winner === 'student') winnerText = 'Student';
              else if (updated.winner === 'player1') winnerText = updated.player1Name || 'Player 1';
              else if (updated.winner === 'player2') winnerText = updated.player2Name || 'Player 2';
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

    // Decide which time pair to tick depending on session type
    const isStudentVsStudent = !!(session.player1Id && session.player2Id);
    const whiteIsPlayer1 = isStudentVsStudent ? (session.player1IsWhite !== false) : (session.adminIsWhite !== false);
    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      const currentTurn = game.turn(); // 'w' or 'b'
      const isWhiteTurn = currentTurn === 'w';

      if (isStudentVsStudent) {
        const isPlayer1Turn = whiteIsPlayer1 ? isWhiteTurn : !isWhiteTurn;
        if (isPlayer1Turn) {
          setPlayer1Time((prev) => {
            const newTime = Math.max(0, prev - delta);
            if (newTime === 0 && prev > 0) {
              // player2 wins
              handleTimeout('player2' as any);
            }
            return newTime;
          });
        } else {
          setPlayer2Time((prev) => {
            const newTime = Math.max(0, prev - delta);
            if (newTime === 0 && prev > 0) {
              handleTimeout('player1' as any);
            }
            return newTime;
          });
        }
      } else {
        const isAdminTurn = (whiteIsPlayer1 && isWhiteTurn) || (!whiteIsPlayer1 && !isWhiteTurn);
        if (isAdminTurn) {
          setAdminTime((prev) => {
            const newTime = Math.max(0, prev - delta);
            if (newTime === 0 && prev > 0) {
              handleTimeout('student');
            }
            return newTime;
          });
        } else {
          setStudentTime((prev) => {
            const newTime = Math.max(0, prev - delta);
            if (newTime === 0 && prev > 0) {
              handleTimeout('admin');
            }
            return newTime;
          });
        }
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session?.status, game]);

  const handleTimeout = async (winner: string) => {
    if (!session) return;
    
    // Clear the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
          player1TimeMs: player1Time,
          player2TimeMs: player2Time,
        }),
      });

      // Emit game-ended via socket (use game-ended so server normalizes winner)
      socket.sendGameEnded({ sessionId: session._id, result: 'timeout', winner });
      // notify user that server will confirm the final result
      toast.info('Time expired; waiting for server to publish final result');
    } catch (err) {
      console.error('Error updating timeout:', err);
    }
  };

  const handleMove = useCallback(async (from: string, to: string) => {
    if (!session || session.status !== 'active') return false;

    // Validate it's this player's turn based on piece color
    const currentTurn = game.turn(); // 'w' or 'b'

    // Determine whether this is a student-vs-student session
    const isStudentVsStudent = !!(session.player1Id && session.player2Id);
    let myColor = 'w';
    if (isStudentVsStudent) {
      const p1IsWhite = session.player1IsWhite !== false;
      const iAmP1 = session.player1Id === user?.id;
      myColor = iAmP1 ? (p1IsWhite ? 'w' : 'b') : (p1IsWhite ? 'b' : 'w');
    } else {
      const adminIsWhite = session.adminIsWhite !== false; // default true
      myColor = role === 'admin' ? (adminIsWhite ? 'w' : 'b') : (adminIsWhite ? 'b' : 'w');
    }
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

      // Do not apply move locally until server confirms it (timers switch after confirmation)

      // Update session in database
      let status: 'active' | 'completed' = 'active';
      let winner: 'admin' | 'student' | 'draw' | null = null;

      

      if (newGame.isCheckmate()) {
        status = 'completed';
        // The player who just moved won. Use the move color (returned by chess.js)
        const movedColor = move ? move.color : (currentTurn === 'w' ? 'b' : 'w');
        if (isStudentVsStudent) {
          const p1IsWhite = session.player1IsWhite !== false;
          // if movedColor is white and white is player1 => player1 won
          const winRole = movedColor === 'w' ? (p1IsWhite ? 'player1' : 'player2') : (p1IsWhite ? 'player2' : 'player1');
          winner = winRole as any;
        } else {
          const adminIsWhite = session.adminIsWhite !== false;
          winner = movedColor === 'w' ? (adminIsWhite ? 'admin' : 'student') : (adminIsWhite ? 'student' : 'admin');
        }
        // Don't set final modal locally; wait for server to broadcast authoritative game-ended
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (newGame.isDraw()) {
        status = 'completed';
        winner = 'draw';
        // wait for server to broadcast draw result
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (newGame.isCheck()) {
        toast.warning('Check!');
      }

      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const bodyPayload: any = {
        fen: newGame.fen(),
        turn: newGame.turn(),
        status,
        winner,
      };
      if (isStudentVsStudent) {
        bodyPayload.player1TimeMs = player1Time;
        bodyPayload.player2TimeMs = player2Time;
      } else {
        bodyPayload.adminTimeMs = adminTime;
        bodyPayload.studentTimeMs = studentTime;
      }

      const res = await fetch(`${API}/sessions/${session._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        console.error('Error updating game');
        // Server rejected move — clear prevFen (no optimistic state applied)
        setPrevFen(null);
        toast.error('Move rejected by server');
        return false;
      }

      // Apply confirmed move locally now (timers will switch because game.turn() changes)
      setGame(newGame);
      
      // Track this move to prevent duplicate application when server confirms
      if (move) {
        const moveId = `${move.from}${move.to}${newGame.fen()}`;
        lastAppliedMoveRef.current = moveId;
      }

      // Emit real-time update via SocketProvider
      // Include the last move so remote clients can highlight it even when
      // we recreate the board from a FEN (which loses move history).
      socket.sendMove({
        sessionId: session._id,
        fen: newGame.fen(),
        turn: newGame.turn(),
        player1TimeMs: isStudentVsStudent ? player1Time : undefined,
        player2TimeMs: isStudentVsStudent ? player2Time : undefined,
        adminTimeMs: !isStudentVsStudent ? adminTime : undefined,
        studentTimeMs: !isStudentVsStudent ? studentTime : undefined,
        lastMove: { from: move.from, to: move.to },
        isCheck: newGame.isCheck(),
      });

      // If the game finished (checkmate/draw), notify server to broadcast game-ended
      if (status === 'completed') {
        try {
          socket.sendGameEnded({ sessionId: session._id, result: newGame.isDraw() ? 'draw' : 'checkmate', winner, fen: newGame.fen() });
        } catch (err) {
          console.error('Failed to send game-ended event', err);
        }
      }

      return true;
    } catch (error) {
      console.error('Move error:', error);
      return false;
    }
  }, [game, session, role, adminTime, studentTime, player1Time, player2Time, user?.id]);

  const handleUndo = useCallback(async () => {
    if (!session || session.gameMode !== 'friendly' || role !== 'admin' || boardSnapshots.length <= 1) {
      return; // Can only undo in friendly matches as admin with moves to undo
    }
    
    try {
      // Remove the last snapshot (current position)
      const newSnapshots = [...boardSnapshots];
      newSnapshots.pop();
      
      if (newSnapshots.length === 0) {
        // Should not happen, but safety check
        return;
      }
      
      // Get the new last snapshot (previous position)
      const previousFen = newSnapshots[newSnapshots.length - 1];
      
      // Update local game state
      setGame(new Chess(previousFen));
      setBoardSnapshots(newSnapshots);
      setCanUndo(newSnapshots.length > 1); // Can undo if more than initial position remains
      //ok
      // Send undo to server and other clients
      socket.sendUndo({ sessionId: session._id, fen: previousFen });
      
      toast.success('Move undone');
    } catch (err) {
      console.error('Undo failed', err);
      toast.error('Failed to undo move');
    }
  }, [session, boardSnapshots, role, socket]);

  const handleResign = async () => {
    if (!session) return;
    socket.sendResign(session._id, role);
    // wait for server to emit final result
    toast.info('You resigned — waiting for server confirmation');
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
    toast.info('Draw accepted — waiting for server confirmation');
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
    setGameEndDetails({});
    setIsAnalyzing(false);
    
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

  const handleAnalyzeBoard = () => {
    // Close the modal so user can see the board with final position
    setGameResult(null);
    // Set analyze mode to show only Go Back button
    setIsAnalyzing(true);
    // Keep the session state so board remains visible with final position
    // Don't navigate away - just close the modal
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
  const isStudentVsStudent = !!(session.player1Id && session.player2Id);
  const myId = user?.id;

  let playerColor: 'white' | 'black' = 'white';
  let opponentColor: 'white' | 'black' = 'black';
  let isPlayerTurn = false;
  let myName = user?.username || 'You';
  let opponentName = 'Opponent';
  let myTimeSec = 600;
  let oppTimeSec = 600;

  if (isStudentVsStudent) {
    const p1IsWhite = session.player1IsWhite !== false;
    const iAmP1 = session.player1Id === myId;
    playerColor = iAmP1 ? (p1IsWhite ? 'white' : 'black') : (p1IsWhite ? 'black' : 'white');
    opponentColor = playerColor === 'white' ? 'black' : 'white';
    isPlayerTurn = iAmP1 ? (currentTurn === (p1IsWhite ? 'w' : 'b')) : (currentTurn === (p1IsWhite ? 'b' : 'w'));
    myName = iAmP1 ? (session.player1Name || (iAmP1 ? user?.username || 'Player 1' : 'Player 1')) : (session.player2Name || 'Player 2');
    opponentName = iAmP1 ? (session.player2Name || 'Player 2') : (session.player1Name || 'Player 1');
    myTimeSec = Math.floor((iAmP1 ? player1Time : player2Time) / 1000);
    oppTimeSec = Math.floor((iAmP1 ? player2Time : player1Time) / 1000);
  } else {
    const adminIsWhite = session.adminIsWhite !== false;
    const iAmAdmin = role === 'admin';
    playerColor = iAmAdmin ? (adminIsWhite ? 'white' : 'black') : (adminIsWhite ? 'black' : 'white');
    opponentColor = playerColor === 'white' ? 'black' : 'white';
    isPlayerTurn = iAmAdmin ? (currentTurn === (adminIsWhite ? 'w' : 'b')) : (currentTurn === (adminIsWhite ? 'b' : 'w'));
    myName = iAmAdmin ? (session.adminName || user?.username || 'Coach') : (session.studentName || 'Student');
    opponentName = iAmAdmin ? (session.studentName || 'Student') : (session.adminName || 'Coach');
    myTimeSec = Math.floor((iAmAdmin ? adminTime : studentTime) / 1000);
    oppTimeSec = Math.floor((iAmAdmin ? studentTime : adminTime) / 1000);
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6">
      <div className="flex flex-col gap-3 md:gap-4 w-full max-w-2xl mx-auto">
        {/* Opponent info (top) */}
        <PlayerInfo
          name={opponentName}
          role={isStudentVsStudent ? 'student' : (role === 'admin' ? 'student' : 'coach')}
          color={opponentColor}
          timeLeft={oppTimeSec}
          isActive={!isPlayerTurn}
        />

        {/* Chess Board - Responsive */}
        <ChessBoard
          game={game}
          onMove={handleMove}
          orientation={playerColor}
          disabled={!isGameActive || !isPlayerTurn || isSpectator}
          lastMove={remoteLastMove}
        />

        {/* Player info (bottom) */}
        <PlayerInfo
          name={myName}
          role={isStudentVsStudent ? 'student' : (role === 'admin' ? 'coach' : 'student')}
          color={playerColor}
          timeLeft={myTimeSec}
          isActive={isPlayerTurn}
        />

        {/* Game status */}
        <GameStatus status={gameStatus} turn={currentTurn} />

        {/* Controls - Responsive buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 py-2">
          {isGameActive && !isAnalyzing ? (
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
                  disabled={!canUndo}
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
          ) : isAnalyzing ? (
            <>
              {/* <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAnalyzing(false)}
                className="gap-2 w-full sm:w-auto text-sm md:text-base py-5 sm:py-2"
              >
                Exit Analysis
              </Button> */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToDashboard}
                className="gap-2 w-full sm:w-auto text-sm md:text-base py-5 sm:py-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button> 
              
            </>
          ) : (
            <>
              {/* Show Analyze Board option when game is completed */}
              {session?.status === 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeBoard}
                  className="gap-2 w-full sm:w-auto text-sm md:text-base py-5 sm:py-2"
                >
                  Analyze Board
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToDashboard}
                className="gap-2 w-full sm:w-auto text-sm md:text-base py-5 sm:py-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Game End Modal */}
      <EndGameModal
        result={gameResult}
        onGoBack={handleBackToDashboard}
        onAnalyze={handleAnalyzeBoard}
        gameStatus={gameEndDetails.status}
        lastMove={remoteLastMove}
        gameEndReason={gameEndDetails.reason as any}
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
