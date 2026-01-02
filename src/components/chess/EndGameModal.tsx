import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Frown, Handshake, Sparkles } from 'lucide-react';

interface EndGameModalProps {
  result: 'win' | 'lose' | 'draw' | null;
  onGoBack: () => void;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({ result, onGoBack }) => {
  useEffect(() => {
    if (!result) return;
    let audio: HTMLAudioElement | null = null;
    try {
      if (result === 'win') {
        audio = new Audio('/sounds/Victory.mp3');
      } else if (result === 'lose') {
        audio = new Audio('/sounds/Defeat.mp3');
      }
      if (audio) {
        audio.volume = 0.6;
        audio.play().catch(() => {});
      }
    } catch (err) {
      // ignore
    }

    return () => {
      try {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      } catch (err) {}
    };
  }, [result]);

  if (!result) return null;

  const getContent = () => {
    switch (result) {
      case 'win':
        return {
          emoji: '🏆',
          icon: <Trophy className="w-20 h-20 md:w-28 md:h-28 text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_25px_rgba(250,204,21,0.6)] animate-pulse" />,
          title: 'VICTORY!',
          subtitle: 'You Won',
          message: 'Outstanding performance! Keep dominating the board.',
          gradient: 'from-yellow-500/20 via-amber-600/20 to-orange-600/20',
          borderGlow: 'border-yellow-500/50 shadow-[0_0_30px_rgba(250,204,21,0.4)]',
          titleGradient: 'bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent',
        };
      case 'lose':
        return {
          emoji: '💪',
          icon: <Frown className="w-20 h-20 md:w-28 md:h-28 text-red-400 mx-auto mb-6 drop-shadow-[0_0_25px_rgba(248,113,113,0.5)]" />,
          title: 'DEFEAT',
          subtitle: 'You Lost',
          message: 'Every loss is a lesson. Rise stronger next time!',
          gradient: 'from-red-500/20 via-rose-600/20 to-pink-600/20',
          borderGlow: 'border-red-500/50 shadow-[0_0_30px_rgba(248,113,113,0.3)]',
          titleGradient: 'bg-gradient-to-r from-red-300 via-red-400 to-rose-500 bg-clip-text text-transparent',
        };
      case 'draw':
        return {
          emoji: '🤝',
          icon: <Handshake className="w-20 h-20 md:w-28 md:h-28 text-blue-400 mx-auto mb-6 drop-shadow-[0_0_25px_rgba(96,165,250,0.5)]" />,
          title: "IT'S A DRAW",
          subtitle: 'Well Matched',
          message: 'Equal skills and strategy. Perfectly balanced game!',
          gradient: 'from-blue-500/20 via-cyan-600/20 to-teal-600/20',
          borderGlow: 'border-blue-500/50 shadow-[0_0_30px_rgba(96,165,250,0.3)]',
          titleGradient: 'bg-gradient-to-r from-blue-300 via-cyan-400 to-teal-500 bg-clip-text text-transparent',
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-300">
      {/* Enhanced Overlay with stronger blur */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/80 backdrop-blur-md" />
      
      {/* Floating particles effect (subtle) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-700" />
      </div>
      
      {/* Modal Content */}
      <div className={`relative bg-gradient-to-br ${content.gradient} backdrop-blur-xl rounded-3xl shadow-2xl border-2 ${content.borderGlow} w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl p-6 sm:p-8 md:p-10 lg:p-12 animate-in zoom-in-95 duration-500 ease-out`}>
        {/* Decorative top sparkle */}
        <div className="absolute -top-3 -right-3 md:-top-4 md:-right-4">
          <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-yellow-300 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        
        {/* Icon with glow */}
        <div className="relative">
          {content.icon}
        </div>
        
        {/* Emoji decoration */}
        <div className="text-5xl sm:text-6xl md:text-7xl text-center mb-4 animate-bounce" style={{ animationDuration: '2s' }}>
          {content.emoji}
        </div>
        
        <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-center mb-3 ${content.titleGradient} drop-shadow-lg tracking-tight`}>
          {content.title}
        </h1>
        
        {content.subtitle && (
          <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-center text-white/90 mb-6 tracking-wide">
            {content.subtitle}
          </h2>
        )}
        
        <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-200 text-center mb-8 sm:mb-10 md:mb-12 px-2 sm:px-4 leading-relaxed">
          {content.message}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-5">
          <Button
            onClick={onGoBack}
            size="lg"
            className="flex-1 text-base sm:text-lg md:text-xl font-bold py-5 sm:py-6 md:py-7 lg:py-8 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 rounded-xl border-2 border-slate-500/30"
          >
            ⬅️ Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};
