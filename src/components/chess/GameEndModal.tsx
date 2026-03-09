import React from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Frown, Handshake } from 'lucide-react';

interface GameEndModalProps {
  result: 'win' | 'lose' | 'draw' | null;
  onRematch: () => void;
  onGoBack: () => void;
}

export const GameEndModal: React.FC<GameEndModalProps> = ({ result, onRematch, onGoBack }) => {
  if (!result) return null;

  const getContent = () => {
    switch (result) {
      case 'win':
        return {
          icon: <Trophy className="w-24 h-24 text-yellow-400 mb-6" />,
          title: '🎉 CONGRATULATIONS',
          subtitle: 'YOU HAVE WON',
          message: 'Well played! Keep improving your game.',
          bgColor: 'from-green-900/30 to-green-800/30',
          borderColor: 'border-green-500/50',
        };
      case 'lose':
        return {
          icon: <Frown className="w-24 h-24 text-red-400 mb-6" />,
          title: 'GOOD GAME',
          subtitle: 'YOU LOST',
          message: 'Better luck next time. Learn and come back stronger.',
          bgColor: 'from-red-900/30 to-red-800/30',
          borderColor: 'border-red-500/50',
        };
      case 'draw':
        return {
          icon: <Handshake className="w-24 h-24 text-blue-400 mb-6" />,
          title: "IT'S A DRAW",
          subtitle: '',
          message: 'A balanced game by both players.',
          bgColor: 'from-blue-900/30 to-blue-800/30',
          borderColor: 'border-blue-500/50',
        };
    }
  };

  const content = getContent();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark blurred background overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Main modal */}
      <div className={`relative z-10 w-full max-w-2xl mx-4 p-12 rounded-2xl border-2 ${content.borderColor} bg-gradient-to-br ${content.bgColor} backdrop-blur-md shadow-2xl`}>
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          {content.icon}
          
          {/* Title */}
          <h1 className="text-5xl font-bold text-white mb-2 tracking-wide">
            {content.title}
          </h1>
          
          {/* Subtitle */}
          {content.subtitle && (
            <h2 className="text-4xl font-bold text-white/90 mb-6">
              {content.subtitle}
            </h2>
          )}
          
          {/* Message */}
          <p className="text-xl text-white/80 mb-12 max-w-md">
            {content.message}
          </p>
          
          {/* Buttons */}
          <div className="flex gap-6 w-full max-w-md">
            <Button
              onClick={onRematch}
              size="lg"
              className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg"
            >
              🔁 Rematch
            </Button>
            <Button
              onClick={onGoBack}
              size="lg"
              variant="outline"
              className="flex-1 h-14 text-lg font-semibold border-2 border-white/50 text-white hover:bg-white/10 shadow-lg"
            >
              ⬅️ Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
