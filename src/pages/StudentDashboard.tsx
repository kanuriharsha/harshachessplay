import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGameRequests } from '@/hooks/useGameRequests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Crown, LogOut, Play, Clock, Loader2, XCircle } from 'lucide-react';

const StudentDashboard: React.FC = () => {
  const { user, role, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { myRequest, activeSession, loading, sendRequest, cancelRequest } = useGameRequests();

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Student Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back! {user?.username || user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>

        {/* Main Card */}
        <Card className="card-shadow">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Play with Coach</CardTitle>
            <CardDescription>
              Request a game session with your coach
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {myRequest ? (
              <div className="text-center space-y-4">
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
              <div className="text-center space-y-4">
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
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
};

export default StudentDashboard;
