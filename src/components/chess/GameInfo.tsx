import React from 'react';
import { Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerInfoProps {
  name: string;
  role: 'coach' | 'student';
  color: 'white' | 'black';
  timeLeft?: number;
  isActive?: boolean;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const PlayerInfo: React.FC<PlayerInfoProps> = ({
  name,
  role,
  color,
  timeLeft,
  isActive = false,
}) => {
  return (
    <div 
      className={cn(
        'flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200',
        isActive 
          ? 'bg-primary/10 border-2 border-primary/30' 
          : 'bg-card border-2 border-transparent card-shadow'
      )}
    >
      <div className="flex items-center gap-3">
        <div 
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center border-2',
            color === 'white' 
              ? 'bg-piece-white border-muted-foreground/20' 
              : 'bg-piece-black border-muted-foreground/20'
          )}
        >
          <User className={cn('w-5 h-5', color === 'white' ? 'text-piece-black' : 'text-piece-white')} />
        </div>
        <div>
          <p className="font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {role} • Playing {color}
          </p>
        </div>
      </div>
      
      {timeLeft !== undefined && (
        <div 
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-lg',
            isActive ? 'bg-foreground text-background' : 'bg-muted text-foreground'
          )}
        >
          <Clock className="w-4 h-4" />
          {formatTime(timeLeft)}
        </div>
      )}
    </div>
  );
};

interface GameStatusProps {
  status: string;
  turn: 'w' | 'b';
}

export const GameStatus: React.FC<GameStatusProps> = ({ status, turn }) => {
  return (
    <div className="text-center py-2">
      <p className="text-sm text-muted-foreground">
        {status || (turn === 'w' ? "White to move" : "Black to move")}
      </p>
    </div>
  );
};
