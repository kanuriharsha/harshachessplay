import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGameRequests } from '@/hooks/useGameRequests';
import { useOnlineStudents } from '@/hooks/useOnlineStudents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Crown, LogOut, Play, Clock, Loader2, XCircle, Users, CheckCircle, Eye } from 'lucide-react';
import { initHealthCheck } from '@/lib/healthCheck';

const StudentDashboard: React.FC = () => {
  const { user, role, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { myRequest, activeSession, loading, sendRequest, cancelRequest } = useGameRequests();
  const { 
    students, 
    incomingRequests, 
    loading: studentsLoading,
    sendPlayRequest, 
    respondToRequest,
    refresh
  } = useOnlineStudents();
  
  const [activeTab, setActiveTab] = useState('coach');

  // Wake up backend when dashboard loads
  useEffect(() => {
    initHealthCheck();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    } else if (!authLoading && role !== 'student') {
      navigate('/admin');
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (activeSession) {
      navigate('/game');
    }
  }, [activeSession, navigate]);

  // Listen for real-time session creation and transfer events
  useEffect(() => {
    const handleSessionCreated = (e: any) => {
      const data = e.detail;
      if (!data) return;
      
      toast.success('Game starting!', {
        duration: 2000,
      });
      
      // Navigate to game immediately
      navigate('/game');
    };

    const handleTransferredIn = (e: any) => {
      const data = e.detail;
      if (!data) return;
      
      toast.success(`You have been transferred into a game!`, {
        duration: 5000,
      });
      
      // Navigate to game
      navigate('/game');
    };

    const handleTransferredOut = (e: any) => {
      const data = e.detail;
      if (!data) return;
      
      toast.warning(`You have been transferred out of your game`, {
        duration: 5000,
      });
      
      // Refresh the dashboard to show current state
      refresh();
    };

    window.addEventListener('app:session-created', handleSessionCreated as EventListener);
    window.addEventListener('app:game-transferred-in', handleTransferredIn as EventListener);
    window.addEventListener('app:game-transferred-out', handleTransferredOut as EventListener);

    return () => {
      window.removeEventListener('app:session-created', handleSessionCreated as EventListener);
      window.removeEventListener('app:game-transferred-in', handleTransferredIn as EventListener);
      window.removeEventListener('app:game-transferred-out', handleTransferredOut as EventListener);
    };
  }, [navigate, refresh]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSendRequest = async () => {
    const { error } = await sendRequest();
    if (error) {
      toast.error(error);
    } else {
      toast.success('Game request sent to coach!');
    }
  };

  const handleCancelRequest = async () => {
    const { error } = await cancelRequest();
    if (error) {
      toast.error(error);
    } else {
      toast.info('Request cancelled');
    }
  };

  const handleSendPlayRequestToStudent = async (studentId: string, studentName: string) => {
    const result = await sendPlayRequest(studentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Play request sent to ${studentName}!`);
    }
  };

  const handleAcceptRequest = async (requestId: string, fromUsername: string) => {
    const result = await respondToRequest(requestId, true);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Accepted play request from ${fromUsername}!`);
    }
  };

  const handleRejectRequest = async (requestId: string, fromUsername: string) => {
    const result = await respondToRequest(requestId, false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.info(`Rejected play request from ${fromUsername}`);
    }
  };

  // Only gate navigation on authLoading. Avoid blocking the whole page
  // when request polling is happening so tab switches remain smooth.
  if (authLoading) {
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Student Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {user?.username || user?.email}!</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>

        {/* Incoming Requests Alert */}
        {incomingRequests.length > 0 && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Incoming Play Requests ({incomingRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {incomingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{req.from.username}</p>
                    <p className="text-sm text-muted-foreground">wants to play • {req.timeControl} min</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleAcceptRequest(req.id, req.from.username)}
                      className="gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Accept
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRejectRequest(req.id, req.from.username)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Spectate Games Card */}
        {/* <Card className="mb-6 card-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Watch Games
            </CardTitle>
            <CardDescription>
              Spectate ongoing games and learn from other players
              {activeSession && (
                <span className="block mt-1 text-orange-500 text-xs">
                  ⚠️ You have an active game. Finish it before spectating.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/spectate')}
              variant="outline"
              className="w-full gap-2"
              disabled={!!activeSession}
            >
              <Eye className="w-4 h-4" />
              {activeSession ? 'Finish your game first' : 'View Ongoing Games'}
            </Button>
          </CardContent>
        </Card> */}

        {/* Main Card with Tabs */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-2xl">Start a Game</CardTitle>
            <CardDescription>
              Play with your coach or challenge other students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="coach">Play with Coach</TabsTrigger>
                <TabsTrigger value="students">Play with Students</TabsTrigger>
              </TabsList>

              {/* Coach Tab */}
              <TabsContent value="coach" className="space-y-6">
                {myRequest ? (
                  <div className="text-center space-y-4 py-8">
                    <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                      <Clock className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Waiting for Coach</h3>
                      <p className="text-sm text-muted-foreground">
                        Your game request has been sent. Please wait for the coach to respond.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleCancelRequest}
                      className="gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Request
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-4 py-8">
                    <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Ready to Play?</h3>
                      <p className="text-sm text-muted-foreground">
                        Send a request to your coach to start a training game.
                      </p>
                    </div>
                    <Button onClick={handleSendRequest} className="gap-2" size="lg">
                      <Play className="w-5 h-5" />
                      Request to Play with Coach
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Students Tab */}
              <TabsContent value="students" className="space-y-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Online Students</h3>
                </div>

                {studentsLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No other students online right now</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Crown className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{student.username}</p>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${student.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                              <span className="text-sm text-muted-foreground">
                                {student.isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleSendPlayRequestToStudent(student.id, student.username)}
                          disabled={!student.isOnline}
                          className="gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Challenge
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium mb-2 text-sm">Student vs Student Rules:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Fixed 15 minutes per player</li>
                    <li>• Random color assignment (White/Black)</li>
                    <li>• Serious game mode only</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;
 
