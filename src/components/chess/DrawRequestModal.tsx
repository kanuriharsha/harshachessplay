import React from 'react';
import { Button } from '@/components/ui/button';
import { Scale, Check, X } from 'lucide-react';

interface DrawRequestModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const DrawRequestModal: React.FC<DrawRequestModalProps> = ({ isOpen, onAccept, onDecline }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-300">
      {/* Enhanced Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/80 backdrop-blur-md" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>
      
      {/* Main modal - Beautiful gradient */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto p-6 sm:p-8 md:p-10 lg:p-12 rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/20 via-orange-600/20 to-yellow-600/20 backdrop-blur-xl shadow-[0_0_40px_rgba(251,191,36,0.4)] animate-in zoom-in-95 duration-500 ease-out">
        <div className="flex flex-col items-center text-center">
          {/* Animated icon with glow */}
          <div className="relative mb-6">
            <Scale className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-amber-300 drop-shadow-[0_0_25px_rgba(252,211,77,0.6)] animate-pulse mx-auto" />
          </div>
          
          {/* Emoji decoration */}
          <div className="text-5xl sm:text-6xl md:text-7xl mb-4 animate-bounce" style={{ animationDuration: '2s' }}>
            🤝
          </div>
          
          {/* Title with gradient */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-400 bg-clip-text text-transparent mb-4 sm:mb-5 md:mb-6 drop-shadow-lg tracking-tight">
            Draw Offer
          </h2>
          
          {/* Message with better spacing */}
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-100 mb-8 sm:mb-10 md:mb-12 px-2 sm:px-4 leading-relaxed font-medium">
            Your opponent has offered a draw.
            <br />
            <span className="text-sm sm:text-base md:text-lg text-amber-200/80 mt-2 block">Do you accept?</span>
          </p>
          
          {/* Beautiful buttons with icons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-5 w-full">
            <Button
              onClick={onAccept}
              size="lg"
              className="flex-1 text-base sm:text-lg md:text-xl font-bold py-5 sm:py-6 md:py-7 lg:py-8 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 rounded-xl border-2 border-green-400/30 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5 sm:w-6 sm:h-6" />
              Accept Draw
            </Button>
            <Button
              onClick={onDecline}
              size="lg"
              className="flex-1 text-base sm:text-lg md:text-xl font-bold py-5 sm:py-6 md:py-7 lg:py-8 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 rounded-xl border-2 border-red-400/30 flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
              Decline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
