import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Swords, Clock, Check, X } from 'lucide-react';

interface RematchModalProps {
  isOpen: boolean;
  initiatorRole?: 'admin' | 'student';
  onAccept: (opts: { adminIsWhite: boolean; timeControl: number }) => void;
  onDecline: () => void;
  defaultTime?: number;
}

export const RematchModal: React.FC<RematchModalProps> = ({ isOpen, initiatorRole = 'student', onAccept, onDecline, defaultTime = 10 }) => {
  const [adminIsWhite, setAdminIsWhite] = useState(true);
  const [timeControl, setTimeControl] = useState<number>(defaultTime);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-300">
      {/* Enhanced overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/80 backdrop-blur-md" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-40 h-40 bg-fuchsia-500/10 rounded-full blur-3xl animate-pulse delay-700" />
      </div>
      
      {/* Main modal */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto p-6 sm:p-8 md:p-10 rounded-3xl bg-gradient-to-br from-violet-500/20 via-purple-600/20 to-fuchsia-600/20 backdrop-blur-xl shadow-[0_0_40px_rgba(167,139,250,0.4)] border-2 border-violet-500/50 animate-in zoom-in-95 duration-500 ease-out">
        {/* Icon header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <Swords className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 text-violet-300 drop-shadow-[0_0_25px_rgba(196,181,253,0.6)] animate-pulse mb-4" />
          
          <div className="text-4xl sm:text-5xl md:text-6xl mb-4 animate-bounce" style={{ animationDuration: '2s' }}>
            🔄
          </div>
          
          <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black bg-gradient-to-r from-violet-200 via-purple-300 to-fuchsia-400 bg-clip-text text-transparent mb-3 sm:mb-4 drop-shadow-lg tracking-tight">
            Rematch Challenge
          </h3>
          
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-100 px-2 sm:px-4 font-medium">
            {initiatorRole === 'student' ? '🎓 Student wants a rematch!' : '🎯 Ready for another round?'}
          </p>
        </div>

        {/* Color selection */}
        <div className="mb-5 sm:mb-6 md:mb-8">
          <label className="text-xs sm:text-sm md:text-base text-violet-200 font-semibold block mb-3 sm:mb-4 flex items-center gap-2">
            <span className="text-lg sm:text-xl">♟️</span>
            Who plays White?
          </label>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              className={`flex-1 py-3 sm:py-4 md:py-5 rounded-xl font-bold text-sm sm:text-base md:text-lg transition-all duration-300 border-2 ${
                adminIsWhite
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-400/50 shadow-lg scale-105'
                  : 'bg-slate-800/50 text-gray-300 border-slate-700 hover:bg-slate-700/50 hover:scale-102'
              }`}
              onClick={() => setAdminIsWhite(true)}
            >
              ⚪ Coach - White
            </button>
            <button
              className={`flex-1 py-3 sm:py-4 md:py-5 rounded-xl font-bold text-sm sm:text-base md:text-lg transition-all duration-300 border-2 ${
                !adminIsWhite
                  ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white border-slate-600/50 shadow-lg scale-105'
                  : 'bg-slate-800/50 text-gray-300 border-slate-700 hover:bg-slate-700/50 hover:scale-102'
              }`}
              onClick={() => setAdminIsWhite(false)}
            >
              ⚫ Coach - Black
            </button>
          </div>
        </div>

        {/* Time control */}
        <div className="mb-6 sm:mb-8 md:mb-10">
          <label className="text-xs sm:text-sm md:text-base text-violet-200 font-semibold block mb-3 sm:mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            Time Control (minutes)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={timeControl}
            onChange={(e) => setTimeControl(Number(e.target.value))}
            className="w-full p-3 sm:p-4 md:p-5 rounded-xl bg-slate-900/70 text-white border-2 border-violet-500/30 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/50 outline-none transition-all text-base sm:text-lg md:text-xl font-bold text-center backdrop-blur-sm"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Button
            onClick={() => onAccept({ adminIsWhite, timeControl })}
            className="flex-1 text-base sm:text-lg md:text-xl font-bold py-5 sm:py-6 md:py-7 lg:py-8 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 rounded-xl border-2 border-green-400/30 flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5 sm:w-6 sm:h-6" />
            Accept
          </Button>
          <Button
            onClick={onDecline}
            className="flex-1 text-base sm:text-lg md:text-xl font-bold py-5 sm:py-6 md:py-7 lg:py-8 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 rounded-xl border-2 border-red-400/30 flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
};
