import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Eye, ArrowLeft, Loader2, Clock, Users } from 'lucide-react';

interface OngoingGame {
  _id: string;
  player1Id?: string;
  player2Id?: string;
  adminId?: string;
  studentId?: string;
  player1Name?: string;
  player2Name?: string;
  adminName?: string;
  studentName?: string;
  fen: string;
  status: string;
  createdAt: string;
  player1IsWhite?: boolean;
  adminIsWhite?: boolean;
  gameMode?: string;
}

const SpectatorGames: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<OngoingGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveGame, setHasActiveGame] = useState(false);

  const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkForActiveGame();
      fetchOngoingGames();
    }
  }, [user]);

  const checkForActiveGame = async () => {
    if (!user) return;
    
    try {
      const res = await fetch(`${API}/sessions/active?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setHasActiveGame(true);
          toast.warning('You have an active game. Finish it before spectating.', {
            duration: 3000,
          });
        }
      }
    } catch (err) {
      console.error('Error checking for active game:', err);
    }
  };

  const fetchOngoingGames = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch ongoing games, optionally excluding games the user is playing in
      console.log('[SPECTATE] Fetching ongoing games for user:', user.id);
      const res = await fetch(`${API}/sessions/ongoing?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        console.log('[SPECTATE] Received games:', data.sessions?.length || 0);
        setGames(data.sessions || []);
      } else {
        console.error('[SPECTATE] Failed to load games:', res.status);
        toast.error('Failed to load ongoing games');
      }
    } catch (err) {
      console.error('Error fetching ongoing games:', err);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSpectate = (gameId: string) => {
    // Prevent spectating if user has an active game
    if (hasActiveGame) {
      toast.error('You cannot spectate while you have an active game. Please finish your game first.');
      return;
    }
    
    // Navigate to game page with spectate parameter
    navigate(`/game?spectate=${gameId}`);
  };

  const handleBackToDashboard = () => {
    navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
  };

  const getPlayerNames = (game: OngoingGame) => {
    // Determine the two players in the game
    if (game.player1Name && game.player2Name) {
      return `${game.player1Name} vs ${game.player2Name}`;
    } else if (game.adminName && game.studentName) {
      return `${game.adminName} vs ${game.studentName}`;
    }
    return 'Game in progress';
  };

  const getGameType = (game: OngoingGame) => {
    if (game.player1Id && game.player2Id) {
      return 'Student vs Student';
    } else if (game.adminId && game.studentId) {
      return 'Coach vs Student';
    }
    return 'Unknown';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Spectate Games
            </h1>
            <p className="text-slate-300">
              Watch ongoing games in real-time
            </p>
          </div>
          <Button 
            onClick={handleBackToDashboard}
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Games List */}
        {games.length === 0 ? (
          <Card className="bg-white/10 border-white/20">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-white/50 mx-auto mb-4" />
              <p className="text-white/70 text-lg">
                No ongoing games at the moment
              </p>
              <p className="text-white/50 text-sm mt-2">
                Check back later or start a new game
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <Card 
                key={game._id}
                className="bg-white/10 border-white/20 hover:bg-white/15 transition-all"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg mb-2">
                        {getPlayerNames(game)}
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        {getGameType(game)}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="bg-green-500/20 text-green-300 border-green-500/30"
                    >
                      Live
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center text-white/60 text-sm">
                      <Clock className="h-4 w-4 mr-2" />
                      Started {formatDate(game.createdAt)}
                    </div>
                    
                    {game.gameMode && (
                      <Badge 
                        variant="outline"
                        className="bg-white/10 text-white/80 border-white/20"
                      >
                        {game.gameMode === 'friendly' ? 'Friendly' : 'Serious'}
                      </Badge>
                    )}
                    
                    <Button 
                      onClick={() => handleSpectate(game._id)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={hasActiveGame}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {hasActiveGame ? 'Finish your game first' : 'Spectate Game'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpectatorGames;
