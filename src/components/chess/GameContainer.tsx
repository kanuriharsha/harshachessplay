import React, { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { PlayerInfo, GameStatus } from './GameInfo';
import { Button } from '@/components/ui/button';
import { RotateCcw, Flag, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface GameContainerProps {
  playerName?: string;
  coachName?: string;
  playerColor?: 'white' | 'black';
  timeControl?: { initial: number; increment: number };
}

export const GameContainer: React.FC<GameContainerProps> = ({
  playerName = 'Student',
  coachName = 'Coach',
  playerColor = 'white',
  timeControl = { initial: 600, increment: 0 },
}) => {
  const [game, setGame] = useState(new Chess());
  const [whiteTime, setWhiteTime] = useState(timeControl.initial);
  const [blackTime, setBlackTime] = useState(timeControl.initial);
  const [isGameActive, setIsGameActive] = useState(true);
  const [gameStatus, setGameStatus] = useState('');

  const currentTurn = game.turn();
  const isPlayerTurn = (playerColor === 'white' && currentTurn === 'w') || 
                       (playerColor === 'black' && currentTurn === 'b');

  // Timer logic
  useEffect(() => {
    if (!isGameActive) return;

    const interval = setInterval(() => {
      if (currentTurn === 'w') {
        setWhiteTime(prev => {
          if (prev <= 0) {
            setIsGameActive(false);
            setGameStatus('Black wins on time!');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime(prev => {
          if (prev <= 0) {
            setIsGameActive(false);
            setGameStatus('White wins on time!');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTurn, isGameActive]);

  const handleMove = useCallback((from: string, to: string, promotion?: string) => {
    try {
      const newGame = new Chess(game.fen());
      const move = newGame.move({ from, to, promotion: promotion || 'q' });
      
      if (move) {
        setGame(newGame);
        
        // Add increment after move
        if (timeControl.increment > 0) {
          if (currentTurn === 'w') {
            setWhiteTime(prev => prev + timeControl.increment);
          } else {
            setBlackTime(prev => prev + timeControl.increment);
          }
        }

        // Check game end conditions
        if (newGame.isCheckmate()) {
          setIsGameActive(false);
          setGameStatus(`Checkmate! ${currentTurn === 'w' ? 'White' : 'Black'} wins!`);
          toast.success('Checkmate!');
        } else if (newGame.isDraw()) {
          setIsGameActive(false);
          setGameStatus('Game drawn!');
          toast.info('Game is a draw');
        } else if (newGame.isCheck()) {
          toast.warning('Check!');
        }

        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [game, currentTurn, timeControl.increment]);

  const handleResign = () => {
    setIsGameActive(false);
    setGameStatus(`${isPlayerTurn ? 'You' : 'Coach'} resigned. ${isPlayerTurn ? 'Coach' : 'You'} wins!`);
    toast.info('Game ended by resignation');
  };

  const handleNewGame = () => {
    setGame(new Chess());
    setWhiteTime(timeControl.initial);
    setBlackTime(timeControl.initial);
    setIsGameActive(true);
    setGameStatus('');
    toast.success('New game started');
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto px-4">
      {/* Opponent info (top) */}
      <PlayerInfo
        name={playerColor === 'white' ? coachName : playerName}
        role={playerColor === 'white' ? 'coach' : 'student'}
        color={playerColor === 'white' ? 'black' : 'white'}
        timeLeft={playerColor === 'white' ? blackTime : whiteTime}
        isActive={playerColor === 'white' ? currentTurn === 'b' : currentTurn === 'w'}
      />

      {/* Chess Board */}
      <ChessBoard
        game={game}
        onMove={handleMove}
        orientation={playerColor}
        disabled={!isGameActive || !isPlayerTurn}
      />

      {/* Player info (bottom) */}
      <PlayerInfo
        name={playerColor === 'white' ? playerName : coachName}
        role={playerColor === 'white' ? 'student' : 'coach'}
        color={playerColor}
        timeLeft={playerColor === 'white' ? whiteTime : blackTime}
        isActive={playerColor === 'white' ? currentTurn === 'w' : currentTurn === 'b'}
      />

      {/* Game status */}
      <GameStatus status={gameStatus} turn={currentTurn} />

      {/* Controls */}
      <div className="flex justify-center gap-3 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewGame}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          New Game
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResign}
          disabled={!isGameActive}
          className="gap-2"
        >
          <Flag className="w-4 h-4" />
          Resign
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </div>
    </div>
  );
};
