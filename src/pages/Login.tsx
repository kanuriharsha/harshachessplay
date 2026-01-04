import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Crown, GraduationCap, LogIn, Eye, EyeOff } from 'lucide-react';
import { initHealthCheck } from '@/lib/healthCheck';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, role } = useAuth();
  const navigate = useNavigate();

  // Wake up backend when login page loads
  useEffect(() => {
    initHealthCheck();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(username, password);

    if (error) {
      toast.error(error);
      setLoading(false);
      return;
    }

    toast.success('Login successful!');
    
    // Navigate based on role returned from server
    if (role === 'admin') navigate('/admin');
    else navigate('/student');
    setLoading(false);
  };

  const quickLogin = async (user: 'admin' | 'student') => {
    const quickUsername = user === 'admin' ? 'harsha' : 'student';
    setUsername(quickUsername);
    const quickPassword = user === 'admin' ? 'admin123' : 'student123';
    setPassword(quickPassword);
    setLoading(true);

    const { error } = await signIn(quickUsername, quickPassword);

    if (error) {
      toast.error(error);
      setLoading(false);
      return;
    }

    toast.success(`Welcome, ${user === 'admin' ? 'Coach' : 'Student'}!`);
    if (role === 'admin') navigate('/admin');
    else navigate('/student');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md card-shadow">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Chess with Harsha Vardhan</CardTitle>
          <CardDescription>Sign in to access your dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <LogIn className="w-4 h-4" />
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Quick Login</span>
            </div>
          </div>

          {/* <div className="grid grid-cols-2 gap-3"> */}
            {/* <Button
              type="button"
              variant="outline"
              onClick={() => quickLogin('admin')}
              disabled={loading}
              className="gap-2"
            >
              <Crown className="w-4 h-4" />
              Coach
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => quickLogin('student')}
              disabled={loading}
              className="gap-2"
            >
              <GraduationCap className="w-4 h-4" />
              Student
            </Button> */}
          {/* </div> */}

          <p className="text-xs text-center text-muted-foreground">
            Created and designed by Kanuri Harsha Vardhan with ❤️
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
