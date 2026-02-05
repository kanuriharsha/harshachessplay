import React from 'react';
import { WhiteQueen, WhiteKnight, WhiteRook, WhiteBishop, BlackQueen, BlackKnight, BlackRook, BlackBishop } from './ChessPieces';
import { cn } from '@/lib/utils';

interface PromotionModalProps {
  color: 'white' | 'black';
  position: { file: string; rank: string };
  onSelect: (piece: 'q' | 'n' | 'r' | 'b') => void;
  onCancel: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({ color, position, onSelect, onCancel }) => {
  const pieces = color === 'white' 
    ? [
        { piece: 'q', Component: WhiteQueen, label: 'Queen' },
        { piece: 'n', Component: WhiteKnight, label: 'Knight' },
        { piece: 'r', Component: WhiteRook, label: 'Rook' },
        { piece: 'b', Component: WhiteBishop, label: 'Bishop' },
      ]
    : [
        { piece: 'q', Component: BlackQueen, label: 'Queen' },
        { piece: 'n', Component: BlackKnight, label: 'Knight' },
        { piece: 'r', Component: BlackRook, label: 'Rook' },
        { piece: 'b', Component: BlackBishop, label: 'Bishop' },
      ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="pointer-events-auto bg-white rounded-lg shadow-2xl p-2 flex flex-col gap-1 min-w-[100px]">
          {/* Close button */}
          <button
            onClick={onCancel}
            className="self-end text-gray-400 hover:text-gray-600 transition-colors mb-1"
            aria-label="Cancel promotion"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="currentColor" 
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Piece selection */}
          {pieces.map(({ piece, Component, label }) => (
            <button
              key={piece}
              onClick={() => onSelect(piece as 'q' | 'n' | 'r' | 'b')}
              className={cn(
                "w-20 h-20 flex items-center justify-center rounded-lg",
                "hover:bg-gray-100 transition-all duration-150",
                "border-2 border-transparent hover:border-blue-400",
                "active:scale-95"
              )}
              title={label}
              aria-label={`Promote to ${label}`}
            >
              <Component className="w-full h-full p-2" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
