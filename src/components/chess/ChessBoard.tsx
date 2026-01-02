import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { getPieceComponent } from './ChessPieces';
import { cn } from '@/lib/utils';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: string, to: string, promotion?: string) => boolean | Promise<boolean>;
  orientation?: 'white' | 'black';
  disabled?: boolean;
  lastMove?: { from: string; to: string } | null;
}

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

// Sound utility - uses files placed in public/sounds
const playSound = (soundType: 'move' | 'capture') => {
  try {
    const map: Record<string, string> = {
      move: '/sounds/Move.mp3',
      capture: '/sounds/Capture.mp3',
    };
    const src = map[soundType] || `/sounds/${soundType}.mp3`;
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Sound play failed:', err));
  } catch (err) {
    console.log('Sound error:', err);
  }
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  game,
  onMove,
  orientation = 'white',
  disabled = false,
  lastMove: lastMoveProp = null,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);

  // Keep lastMove in sync with the external `game` prop so both players
  // (with different orientations) highlight the same recent move.
  const _fen = useMemo(() => game.fen(), [game]);
  useEffect(() => {
    try {
      const moves = (game.history({ verbose: true }) as any[]) || [];
      if (moves.length === 0) {
        setLastMove(null);
        return;
      }
      const m = moves[moves.length - 1];
      if (m && m.from && m.to) {
        setLastMove({ from: m.from, to: m.to });
      }
    } catch (err) {
      // ignore
    }
  }, [_fen]);

  // Also accept lastMove from a parent (socket/server) so clients that
  // receive only a FEN can still highlight the recent move.
  useEffect(() => {
    if (lastMoveProp && lastMoveProp.from && lastMoveProp.to) {
      setLastMove(lastMoveProp);
    }
  }, [lastMoveProp]);

  const boardFiles = orientation === 'white' ? files : [...files].reverse();
  const boardRanks = orientation === 'white' ? ranks : [...ranks].reverse();

  const getPieceAtSquare = useCallback((square: string) => {
    const piece = game.get(square as Square);
    if (!piece) return null;
    const color = piece.color === 'w' ? 'w' : 'b';
    const type = piece.type.toUpperCase();
    return `${color}${type}`;
  }, [game]);

  const handleSquareClick = useCallback(async (square: string) => {
    if (disabled) return;

    const piece = game.get(square as Square);
    
    // If clicking on the already selected piece, deselect it
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }
    
    // If we have a selected piece and click on a legal move square
    if (selectedSquare && legalMoves.includes(square)) {
      // Determine if this move captures using verbose moves (handles en-passant/promotions)
      const movesVerbose: any[] = game.moves({ square: selectedSquare as Square, verbose: true }) as any[];
      const moveObj: any = movesVerbose.find((m: any) => m.to === square);
      const isCapture = !!(moveObj && (moveObj.captured || (moveObj.flags && moveObj.flags.includes('e'))));

      const moveResult = await onMove(selectedSquare, square);
      if (moveResult) {
        setLastMove({ from: selectedSquare, to: square });
        // Play appropriate sound
        playSound(isCapture ? 'capture' : 'move');
      }
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // If clicking on own piece, select it
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as Square, verbose: true });
      setLegalMoves(moves.map(m => m.to));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [game, selectedSquare, legalMoves, onMove, disabled]);

  const isLightSquare = (file: string, rank: string) => {
    const fileIndex = files.indexOf(file);
    const rankIndex = parseInt(rank);
    return (fileIndex + rankIndex) % 2 === 1;
  };

  const isHighlighted = (square: string) => {
    return lastMove?.from === square || lastMove?.to === square;
  };

  const isLegalMove = (square: string) => {
    return legalMoves.includes(square);
  };

  const hasCapture = (square: string) => {
    if (!isLegalMove(square)) return false;
    const piece = game.get(square as Square);
    return piece !== null;
  };

  return (
    <div className="relative w-full max-w-[min(90vw,560px)] aspect-square mx-auto">
      <div className="absolute inset-0 rounded-lg board-shadow bg-card overflow-hidden">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {boardRanks.map((rank, rankIndex) =>
            boardFiles.map((file, fileIndex) => {
              const square = `${file}${rank}`;
              const piece = getPieceAtSquare(square);
              const PieceComponent = getPieceComponent(piece);
              const isLight = isLightSquare(file, rank);
              const highlighted = isHighlighted(square);
              const isSelected = selectedSquare === square;
              const legalMove = isLegalMove(square);
              const capture = hasCapture(square);
              const isHovered = hoveredSquare === square && piece;

              return (
                <div
                  key={square}
                  className={cn(
                    'relative flex items-center justify-center cursor-pointer transition-colors duration-100',
                    isLight ? 'bg-board-light' : 'bg-board-dark',
                    highlighted && 'bg-board-highlight/70',
                    isSelected && 'bg-board-highlight/80'
                  )}
                  onClick={() => handleSquareClick(square)}
                  onMouseEnter={() => setHoveredSquare(square)}
                  onMouseLeave={() => setHoveredSquare(null)}
                >
                  {/* Coordinate labels */}
                  {fileIndex === 0 && (
                    <span 
                      className={cn(
                        'absolute top-0.5 left-1 text-[10px] font-semibold select-none',
                        isLight ? 'text-board-dark' : 'text-board-light'
                      )}
                    >
                      {rank}
                    </span>
                  )}
                  {rankIndex === 7 && (
                    <span 
                      className={cn(
                        'absolute bottom-0.5 right-1 text-[10px] font-semibold select-none',
                        isLight ? 'text-board-dark' : 'text-board-light'
                      )}
                    >
                      {file}
                    </span>
                  )}

                  {/* Legal move indicator */}
                  {legalMove && !capture && (
                    <div className="absolute w-[28%] h-[28%] rounded-full bg-board-legal-move/40" />
                  )}
                  
                  {/* Capture indicator */}
                  {legalMove && capture && (
                    <div className="absolute inset-[8%] rounded-full border-[4px] border-board-legal-move/50" />
                  )}

                  {/* Piece */}
                  {PieceComponent && (
                    <div 
                      className={cn(
                        'w-[85%] h-[85%] piece-shadow transition-transform duration-100',
                        isHovered && !disabled && 'scale-105 -translate-y-0.5',
                        isSelected && 'scale-105 -translate-y-1'
                      )}
                    >
                      <PieceComponent className="w-full h-full" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
