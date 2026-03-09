import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRightLeft, User, Gamepad2 } from 'lucide-react';
import { toast } from 'sonner';

interface ActiveGame {
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
}

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'student';
}

interface TransferGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromUserId: string;
  fromUsername: string;
  onTransferSuccess: () => void;
}

const TransferGameModal: React.FC<TransferGameModalProps> = ({
  isOpen,
  onClose,
  fromUserId,
  fromUsername,
  onTransferSuccess,
}) => {
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedToUserId, setSelectedToUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

  // Fetch active games for the selected user - OPTIMIZED
  useEffect(() => {
    if (!isOpen || !fromUserId) return;

    const fetchUserGames = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/users/${fromUserId}/active-games`);
        if (res.ok) {
          const data = await res.json();
          setActiveGames(data.games || []);
          
          // Auto-select first game if only one
          if (data.games && data.games.length === 1) {
            setSelectedGameId(data.games[0]._id);
          }
        }
      } catch (err) {
        console.error('Error fetching user games:', err);
        toast.error('Failed to load games');
      } finally {
        setLoading(false);
      }
    };

    fetchUserGames();
  }, [isOpen, fromUserId]);

  // Fetch available users (those without active games) - OPTIMIZED
  useEffect(() => {
    if (!isOpen || !selectedGameId) return;

    const fetchAvailableUsers = async () => {
      try {
        const usersRes = await fetch(`${API}/users/available?excludeUserId=${fromUserId}`);
        if (!usersRes.ok) return;
        const usersData = await usersRes.json();
        setAvailableUsers(usersData.users || []);
      } catch (err) {
        console.error('Error fetching available users:', err);
        toast.error('Failed to load available users');
      }
    };

    fetchAvailableUsers();
  }, [isOpen, selectedGameId, fromUserId]);

  const handleTransfer = async () => {
    if (!selectedGameId || !selectedToUserId) {
      toast.error('Please select a game and a target user');
      return;
    }

    setTransferring(true);
    try {
      const res = await fetch(`${API}/sessions/${selectedGameId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId,
          toUserId: selectedToUserId,
          adminId: fromUserId, // for logging purposes
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Game transferred successfully!');
        onTransferSuccess();
        onClose();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to transfer game');
      }
    } catch (err) {
      console.error('Transfer error:', err);
      toast.error('Network error during transfer');
    } finally {
      setTransferring(false);
    }
  };

  const getOpponentInfo = (game: ActiveGame) => {
    // Determine who the opponent is (the other player, not fromUserId)
    const players = [];
    
    if (game.player1Id && String(game.player1Id) !== String(fromUserId)) {
      players.push(game.player1Name || 'Player 1');
    } else if (game.player2Id && String(game.player2Id) !== String(fromUserId)) {
      players.push(game.player2Name || 'Player 2');
    }
    
    if (game.adminId && String(game.adminId) !== String(fromUserId)) {
      players.push(game.adminName || 'Admin');
    } else if (game.studentId && String(game.studentId) !== String(fromUserId)) {
      players.push(game.studentName || 'Student');
    }

    return players.join(' vs ');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transfer Game
          </DialogTitle>
          <DialogDescription>
            Transfer <strong>{fromUsername}</strong>'s active game to another available user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : activeGames.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {fromUsername} has no active games to transfer
              </p>
            </div>
          ) : (
            <>
              {/* Select Game */}
              <div className="space-y-2">
                <Label htmlFor="game-select" className="text-sm font-medium">
                  Select Game to Transfer
                </Label>
                <div className="space-y-2">
                  {activeGames.map((game) => (
                    <div
                      key={game._id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedGameId === game._id
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedGameId(game._id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="w-4 h-4 text-primary" />
                          <div>
                            <p className="font-medium text-sm">
                              {fromUsername} vs {getOpponentInfo(game)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Started: {new Date(game.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant={game.status === 'active' ? 'default' : 'secondary'}>
                          {game.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Select Target User */}
              {selectedGameId && (
                <div className="space-y-2">
                  <Label htmlFor="user-select" className="text-sm font-medium">
                    Transfer To (Available Users)
                  </Label>
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No available users (all users are currently in games)
                    </p>
                  ) : (
                    <select
                      id="user-select"
                      value={selectedToUserId}
                      onChange={(e) => setSelectedToUserId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="">Select a user...</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username || user.email} ({user.role})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={transferring}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedGameId || !selectedToUserId || transferring}
            className="gap-2"
          >
            {transferring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Transfer Game
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransferGameModal;
