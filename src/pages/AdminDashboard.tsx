import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGameRequests } from '@/hooks/useGameRequests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Crown, LogOut, Check, X, Clock, Loader2, Users, Settings, Save, Edit, UserCog } from 'lucide-react';

const TIME_OPTIONS = [5, 10, 15, 20, 25];

interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'student';
  createdAt: string;
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
  // Add user state (admin-only)
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'student' as 'admin' | 'student' });

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

  useEffect(() => {
    if (user && role === 'admin') {
      fetchUsers();
    }
  }, [user, role]);

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
              <h1 className="text-xl font-bold">Student Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back! {user?.username || user?.email}</p>
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

        {/* User Management Section */}
        {showUserManagement && (
          <Card className="card-shadow mb-6">
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
                          <div className="w-full sm:w-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUser(u)}
                              className="gap-2 w-full sm:w-auto"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
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
        )}

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
      </div>
    </div>
  );
};

export default AdminDashboard;
