import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGameRequests } from '@/hooks/useGameRequests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Crown, LogOut, Check, X, Clock, Loader2, Users, Settings, Save, Edit, UserCog, Eye, Gamepad2, Trash2, Menu } from 'lucide-react';
import { initHealthCheck } from '@/lib/healthCheck';

const TIME_OPTIONS = [5, 10, 15, 20, 25];

interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'student';
  createdAt: string;
}

interface ActiveGame {
  _id: string;
  player1Name: string;
  player2Name: string;
  player1Id?: string;
  player2Id?: string;
  adminId?: string;
  studentId?: string;
  fen: string;
  status: string;
  createdAt: string;
  winner?: string | null;
  winnerId?: string | null;
  adminName?: string | null;
  studentName?: string | null;
}

const AdminDashboard: React.FC = () => {
  const { user, role, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { pendingRequests, activeSession, loading, acceptRequest, rejectRequest } = useGameRequests();
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [adminIsWhite, setAdminIsWhite] = useState<boolean>(true);
  const [selectedGameMode, setSelectedGameMode] = useState<'friendly' | 'serious'>('serious');
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);
  
  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ username: '', password: '', email: '' });
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'student' as 'admin' | 'student' });

  // Spectator mode state
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [historyGames, setHistoryGames] = useState<ActiveGame[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('requests');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // History filter/sort state
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [filterWinner, setFilterWinner] = useState<string | null>(null);
  const [filterLoser, setFilterLoser] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'winner' | 'loser'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Wake up backend when dashboard loads
  useEffect(() => {
    initHealthCheck();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    } else if (!authLoading && role !== 'admin') {
      navigate('/student');
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (activeSession) {
      navigate('/game');
    }
  }, [activeSession, navigate]);

  // Fetch users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (err) {
      toast.error('Error fetching users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch active games for spectating
  const fetchActiveGames = async () => {
    setLoadingGames(true);
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/sessions?limit=50`);
      if (res.ok) {
        const data = await res.json();
        // show only active sessions for spectating
        const onlyActive = (data.sessions || []).filter((s: any) => s.status === 'active');
        setActiveGames(onlyActive);
      }
    } catch (err) {
      console.error('Error fetching active games:', err);
    } finally {
      setLoadingGames(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/sessions?limit=200`);
      if (res.ok) {
        const data = await res.json();
        setHistoryGames(data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSpectateGame = async (gameId: string) => {
    if (!user) return;
    
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      // Register as spectator
      await fetch(`${API}/sessions/${gameId}/spectate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id })
      });
      
      // Navigate to game as spectator
      navigate(`/game?spectate=${gameId}`);
    } catch (err) {
      toast.error('Failed to join game as spectator');
    }
  };

  const handleDeleteHistory = async (gameId: string) => {
    if (!window.confirm('Delete this game record? This cannot be undone.')) return;
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/sessions/${gameId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Game history deleted');
        setHistoryGames((h) => h.filter((g) => g._id !== gameId));
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to delete game');
      }
    } catch (err) {
      console.error('Delete history failed', err);
      toast.error('Network error deleting game');
    }
  };

  useEffect(() => {
    if (user && role === 'admin') {
      fetchUsers();
      fetchActiveGames();
      fetchHistory();
      
      // Poll for active games every 10 seconds
      const interval = setInterval(fetchActiveGames, 10000);
      return () => clearInterval(interval);
    }
  }, [user, role]);

  // Build list of unique player names for filter dropdowns
  const uniquePlayers = useMemo(() => {
    const s = new Set<string>();
    historyGames.forEach((g) => {
      if (g.player1Name) s.add(g.player1Name);
      if (g.player2Name) s.add(g.player2Name);
      if (g.adminName) s.add(g.adminName);
      if (g.studentName) s.add(g.studentName);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [historyGames]);

  // Derived filtered + sorted history list
  const filteredGames = useMemo(() => {
    let list = [...historyGames];

    // Date filters
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((g) => new Date(g.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59');
      list = list.filter((g) => new Date(g.createdAt) <= to);
    }

    // Helper to compute winner/loser names (same logic used by rendering)
    const computeWinnerName = (g: any) => {
      if (g.winner === 'draw') return 'Draw';
      if (g.winnerId) {
        if (g.winnerId === g.player1Id) return g.player1Name || '';
        if (g.winnerId === g.player2Id) return g.player2Name || '';
        if (g.winnerId === g.adminId) return g.adminName || '';
        if (g.winnerId === g.studentId) return g.studentName || '';
        return String(g.winner || '');
      }
      if (g.winner) {
        if (g.winner === 'player1') return g.player1Name || '';
        if (g.winner === 'player2') return g.player2Name || '';
        if (g.winner === 'admin') return g.adminName || '';
        if (g.winner === 'student') return g.studentName || '';
        return String(g.winner);
      }
      return '';
    };

    const computeLoserName = (g: any, winnerName: string) => {
      if (g.winner === 'draw') return 'Draw';
      // infer loser by comparing player names
      const p1 = g.player1Name || g.adminName || 'Player 1';
      const p2 = g.player2Name || g.studentName || 'Player 2';
      if (winnerName === (g.player1Name || '')) return p2;
      if (winnerName === (g.player2Name || '')) return p1;
      if (winnerName === (g.adminName || '')) return g.studentName || 'Student';
      if (winnerName === (g.studentName || '')) return g.adminName || 'Admin';
      return '';
    };

    // Winner filter
    if (filterWinner) {
      list = list.filter((g) => computeWinnerName(g) === filterWinner);
    }

    // Loser filter
    if (filterLoser) {
      list = list.filter((g) => {
        const wn = computeWinnerName(g);
        const ln = computeLoserName(g, wn);
        return ln === filterLoser;
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'date') {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortOrder === 'asc' ? da - db : db - da;
      }
      const wa = computeWinnerName(a) || '';
      const wb = computeWinnerName(b) || '';
      const la = computeLoserName(a, wa) || '';
      const lb = computeLoserName(b, wb) || '';
      if (sortBy === 'winner') {
        const cmp = wa.localeCompare(wb);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      // sortBy === 'loser'
      const cmp = la.localeCompare(lb);
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [historyGames, dateFrom, dateTo, filterWinner, filterLoser, sortBy, sortOrder]);

  const handleEditUser = (u: User) => {
    setEditingUserId(u.id);
    setEditForm({ username: u.username || '', password: '', email: u.email });
  };

  const handleSaveUser = async (userId: string) => {
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editForm.username,
          password: editForm.password,
          email: editForm.email,
        }),
      });

      if (res.ok) {
        toast.success('User updated successfully');
        setEditingUserId(null);
        setEditForm({ username: '', password: '', email: '' });
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update user');
      }
    } catch (err) {
      toast.error('Error updating user');
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) {
      toast.error('Username and password are required');
      return;
    }
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUser.username, email: newUser.email, password: newUser.password, role: newUser.role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Create failed' }));
        toast.error(body.error || 'Failed to create user');
        return;
      }
      toast.success('User created');
      setNewUser({ username: '', email: '', password: '', role: 'student' });
      setShowAddUser(false);
      fetchUsers();
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditForm({ username: '', password: '', email: '' });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('User deleted');
        setUsers((u) => u.filter((x) => x.id !== userId));
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Delete user failed', err);
      toast.error('Network error deleting user');
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setMobileMenuOpen(false);
  };

  const handleAccept = async (requestId: string) => {
    if (!selectedTime) {
      toast.error('Please select a time control');
      return;
    }

    const { error } = await acceptRequest(requestId, selectedTime, adminIsWhite, selectedGameMode);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Game starting!');
    }
    setAcceptingRequestId(null);
    setSelectedTime(null);
    setAdminIsWhite(true);
    setSelectedGameMode('serious');
  };

  const handleReject = async (requestId: string) => {
    const { error } = await rejectRequest(requestId);
    if (error) {
      toast.error(error);
    } else {
      toast.info('Request declined');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {user?.username || user?.email}!</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant={showUserManagement ? "default" : "outline"} 
              onClick={() => setShowUserManagement(!showUserManagement)} 
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              User Management
            </Button>
            <Button variant="outline" onClick={handleSignOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Hamburger Menu Button (Mobile) */}
        <div className="sm:hidden mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="gap-2"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {mobileMenuOpen ? 'Close Menu' : 'Menu'}
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className={`w-full flex-col sm:flex-row gap-2 ${mobileMenuOpen ? 'flex' : 'hidden sm:flex'}`}>
            <TabsTrigger value="requests" className="w-full text-center py-2 rounded-md">
              Play Requests
              {pendingRequests.length > 0 && (
                <Badge className="ml-2" variant="destructive">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="spectate" className="w-full text-center py-2 rounded-md">
              Spectate Games
              {activeGames.length > 0 && (
                <Badge className="ml-2">{activeGames.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="w-full text-center py-2 rounded-md">
              Game History
              {historyGames.length > 0 && (
                <Badge className="ml-2">{historyGames.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="w-full text-center py-2 rounded-md">User Management</TabsTrigger>
          </TabsList>

          {/* Play Requests Tab */}
          <TabsContent value="requests">
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle>Student Play Requests</CardTitle>
            <CardDescription>
              Review and respond to student requests to play
            </CardDescription>
          </CardHeader>
          <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Add User */}
                  <div className="p-3 rounded-md border bg-card">
                    {!showAddUser ? (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">Create new user</p>
                          <p className="text-sm text-muted-foreground">Admin can add new users</p>
                        </div>
                        <Button onClick={() => setShowAddUser(true)} className="ml-2">Add User</Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="new-username" className="text-sm">Username</Label>
                            <Input id="new-username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                          </div>
                          <div>
                            <Label htmlFor="new-email" className="text-sm">Email</Label>
                            <Input id="new-email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="new-password" className="text-sm">Password</Label>
                            <Input id="new-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                          </div>
                          <div>
                            <Label htmlFor="new-role" className="text-sm">Role</Label>
                            <select id="new-role" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })} className="w-full rounded-md border px-2 py-1">
                              <option value="student">Student</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button onClick={handleAddUser} className="flex-1">Create</Button>
                          <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      {editingUserId === u.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`username-${u.id}`} className="text-sm font-medium mb-2 block">
                                Username
                              </Label>
                              <Input
                                id={`username-${u.id}`}
                                type="text"
                                value={editForm.username}
                                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                placeholder="Enter username"
                                className="w-full"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`email-${u.id}`} className="text-sm font-medium mb-2 block">
                                Email
                              </Label>
                              <Input
                                id={`email-${u.id}`}
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                placeholder="Enter email"
                                className="w-full"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor={`password-${u.id}`} className="text-sm font-medium mb-2 block">
                              New Password (leave blank to keep current)
                            </Label>
                            <Input
                              id={`password-${u.id}`}
                              type="password"
                              value={editForm.password}
                              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                              placeholder="Enter new password"
                              className="w-full"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleSaveUser(u.id)} className="gap-2">
                              <Save className="w-4 h-4" />
                              Save Changes
                            </Button>
                            <Button variant="outline" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              u.role === 'admin' ? 'bg-amber-500/20' : 'bg-blue-500/20'
                            }`}>
                              {u.role === 'admin' ? (
                                <Crown className="w-5 h-5 text-amber-500" />
                              ) : (
                                <Users className="w-5 h-5 text-blue-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{u.username || 'No username'}</p>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                              <p className="text-xs text-muted-foreground">
                                {u.role === 'admin' ? '👑 Admin' : '🎓 Student'}
                              </p>
                            </div>
                          </div>
                          <div className="w-full sm:w-auto flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUser(u)}
                              className="gap-2 w-full sm:w-auto"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(u.id)}
                              className="gap-2 w-full sm:w-auto"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        

        {/* Pending Requests */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Game Requests
            </CardTitle>
            <CardDescription>
              Students waiting to play with you
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No pending requests</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Students will appear here when they request a game
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div
                    key={request._id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium">Student <span className="font-bold">{users.find(u => u.id === request.studentId)?.username || 'Student'}</span> wants to play</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {acceptingRequestId === request._id ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Select time control:</p>
                        <div className="flex flex-wrap gap-2">
                          {TIME_OPTIONS.map((time) => (
                            <Button
                              key={time}
                              variant={selectedTime === time ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setSelectedTime(time)}
                            >
                              {time} min
                            </Button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Choose your pieces:</p>
                          <div className="flex gap-2">
                            <Button
                              variant={adminIsWhite ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setAdminIsWhite(true)}
                              className="flex-1"
                            >
                              ⚪ White (You play first)
                            </Button>
                            <Button
                              variant={!adminIsWhite ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setAdminIsWhite(false)}
                              className="flex-1"
                            >
                              ⚫ Black (Student plays first)
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Game mode:</p>
                          <div className="flex gap-2">
                            <Button
                              variant={selectedGameMode === 'friendly' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setSelectedGameMode('friendly')}
                              className="flex-1"
                            >
                              Friendly (admin may undo)
                            </Button>
                            <Button
                              variant={selectedGameMode === 'serious' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setSelectedGameMode('serious')}
                              className="flex-1"
                            >
                              Serious (no undo)
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                          <Button
                            onClick={() => handleAccept(request._id)}
                            disabled={!selectedTime}
                            className="flex-1 gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Start Game
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAcceptingRequestId(null);
                              setSelectedTime(null);
                              setAdminIsWhite(true);
                              setSelectedGameMode('serious');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          onClick={() => setAcceptingRequestId(request._id)}
                          className="flex-1 gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleReject(request._id)}
                          className="gap-2"
                        >
                          <X className="w-4 h-4" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Spectate Games Tab */}
          <TabsContent value="spectate">
            <Card className="card-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      Active Games
                    </CardTitle>
                    <CardDescription>
                      Watch ongoing student games in read-only mode
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchActiveGames}>
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingGames ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : activeGames.length === 0 ? (
                  <div className="text-center py-12">
                    <Gamepad2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-muted-foreground">No active games right now</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeGames.map((game) => (
                      <div
                        key={game._id}
                        className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                                <span className="text-xs font-bold">W</span>
                              </div>
                              <span className="font-medium">{game.player1Name}</span>
                            </div>
                            <span className="text-muted-foreground">vs</span>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center">
                                <span className="text-xs font-bold text-white">B</span>
                              </div>
                              <span className="font-medium">{game.player2Name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Badge variant="outline">{game.status}</Badge>
                            <span>• Started {new Date(game.createdAt).toLocaleTimeString()}</span>
                            {game.status !== 'active' && (
                              <span className="ml-2 text-sm">
                                • Result: {game.winner === 'draw' ? 'Draw' : (
                                  game.winnerId ? (
                                    game.winnerId === game.player1Id ? game.player1Name : (game.winnerId === game.player2Id ? game.player2Name : (game.winnerId === game.adminId ? game.adminName : (game.winnerId === game.studentId ? game.studentName : 'Winner')))
                                  ) : (typeof game.winner === 'string' ? game.winner : 'Finished')
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleSpectateGame(game._id)}
                          className="gap-2 w-full sm:w-auto"
                        >
                          <Eye className="w-4 h-4" />
                          Spectate
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Game History Tab */}
          <TabsContent value="history">
            <Card className="card-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Gamepad2 className="w-5 h-5" />
                      Game History
                    </CardTitle>
                    <CardDescription>
                      Recent games and results (winner, loser, date)
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchHistory}>
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : historyGames.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No games recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Filters & sorting controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">From</Label>
                        <Input type="date" value={dateFrom || ''} onChange={(e) => setDateFrom(e.target.value || null)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">To</Label>
                        <Input type="date" value={dateTo || ''} onChange={(e) => setDateTo(e.target.value || null)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Sort</Label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-md border px-2 py-1">
                          <option value="date">Date</option>
                          <option value="winner">Winner</option>
                          <option value="loser">Loser</option>
                        </select>
                        <button onClick={() => setSortOrder((s) => (s === 'asc' ? 'desc' : 'asc'))} className="ml-2 rounded-md border px-2 py-1">
                          {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Winner</Label>
                        <select value={filterWinner || ''} onChange={(e) => setFilterWinner(e.target.value || null)} className="rounded-md border px-2 py-1 w-full">
                          <option value="">All</option>
                          <option value="Draw">Draw</option>
                          {uniquePlayers.map((p) => (
                            <option key={`w-${p}`} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Loser</Label>
                        <select value={filterLoser || ''} onChange={(e) => setFilterLoser(e.target.value || null)} className="rounded-md border px-2 py-1 w-full">
                          <option value="">All</option>
                          <option value="Draw">Draw</option>
                          {uniquePlayers.map((p) => (
                            <option key={`l-${p}`} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setDateFrom(null); setDateTo(null); setFilterWinner(null); setFilterLoser(null); setSortBy('date'); setSortOrder('desc'); }}>
                          Reset
                        </Button>
                      </div>
                    </div>

                    {filteredGames.map((game) => {
                      // determine players
                      const p1 = game.player1Name || game.adminName || 'Player 1';
                      const p2 = game.player2Name || game.studentName || 'Player 2';
                      let winnerText = '—';
                      let loserText = '—';
                      if (game.winner === 'draw') {
                        winnerText = 'Draw';
                        loserText = 'Draw';
                      } else if (game.winnerId) {
                        if (game.winnerId === game.player1Id) {
                          winnerText = game.player1Name || p1;
                          loserText = game.player2Name || p2;
                        } else if (game.winnerId === game.player2Id) {
                          winnerText = game.player2Name || p2;
                          loserText = game.player1Name || p1;
                        } else if (game.winnerId === game.adminId) {
                          winnerText = game.adminName || 'Admin';
                          loserText = game.studentName || 'Student';
                        } else if (game.winnerId === game.studentId) {
                          winnerText = game.studentName || 'Student';
                          loserText = game.adminName || 'Admin';
                        } else {
                          winnerText = String(game.winner || 'Winner');
                        }
                      } else if (game.winner) {
                        if (game.winner === 'player1') {
                          winnerText = game.player1Name || p1;
                          loserText = game.player2Name || p2;
                        } else if (game.winner === 'player2') {
                          winnerText = game.player2Name || p2;
                          loserText = game.player1Name || p1;
                        } else if (game.winner === 'admin') {
                          winnerText = game.adminName || 'Admin';
                          loserText = game.studentName || 'Student';
                        } else if (game.winner === 'student') {
                          winnerText = game.studentName || 'Student';
                          loserText = game.adminName || 'Admin';
                        } else {
                          winnerText = String(game.winner);
                        }
                      }

                      return (
                        <div key={game._id} className="p-3 rounded-md border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="font-medium">{p1}</div>
                              <div className="text-muted-foreground">vs</div>
                              <div className="font-medium">{p2}</div>
                            </div>
                            <div className="text-sm text-muted-foreground mt-2">
                              <span className="mr-3"><strong>Winner:</strong> <span className="text-green-600 font-semibold">{winnerText}</span></span>
                              <span><strong>Loser:</strong> <span className="text-red-600 font-semibold">{loserText}</span></span>
                            </div>
                          </div>
                          <div className="w-full sm:w-auto flex items-center gap-3 justify-between">
                            <div className="text-sm text-muted-foreground">{new Date(game.createdAt).toLocaleString()}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{game.status}</Badge>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteHistory(game._id)} className="gap-2 w-full sm:w-auto">
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users">
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="w-5 h-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage usernames and passwords for all users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Add User */}
                    <div className="p-3 rounded-md border bg-card">
                      {!showAddUser ? (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">Create new user</p>
                            <p className="text-sm text-muted-foreground">Admin can add new users</p>
                          </div>
                          <Button onClick={() => setShowAddUser(true)} className="ml-2">Add User</Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <Label>Username</Label>
                              <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                            </div>
                            <div>
                              <Label>Email (optional)</Label>
                              <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                            </div>
                            <div>
                              <Label>Password</Label>
                              <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                            </div>
                            <div>
                              <Label>Role</Label>
                              <select
                                className="w-full px-3 py-2 border rounded-md"
                                value={newUser.role}
                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'student' })}
                              >
                                <option value="student">Student</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => { setShowAddUser(false); setNewUser({ username: '', email: '', password: '', role: 'student' }); }}>Cancel</Button>
                            <Button onClick={handleAddUser}>Create User</Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* List Users */}
                    {users.map((u) => (
                      <div key={u.id} className="p-3 rounded-md border bg-card">
                        {editingUserId === u.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <Label>Username</Label>
                                <Input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
                              </div>
                              <div>
                                <Label>Email</Label>
                                <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                              </div>
                              <div>
                                <Label>New Password (optional)</Label>
                                <Input type="password" placeholder="Leave blank to keep current" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                              <Button size="sm" onClick={() => handleSaveUser(u.id)} className="gap-1">
                                <Save className="w-4 h-4" />
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{u.username}</p>
                                <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{u.email || 'No email'}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleEditUser(u)} className="gap-1">
                              <Edit className="w-4 h-4" />
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
