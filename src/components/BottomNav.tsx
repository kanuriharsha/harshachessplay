import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Trophy, Crown, LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  {
    label: 'Home',
    icon: Home,
    path: '/student',
  },
  {
    label: 'Leaderboard',
    icon: Trophy,
    path: '/leaderboard',
  },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActivePath = (path: string) =>
    location.pathname === path || (path === '/student' && location.pathname === '/dashboard');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Desktop left sidebar — Chess Coach style */}
      <nav className="hidden lg:flex fixed left-0 top-0 z-50 h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
        {/* Branding */}
        <div className="flex items-center gap-4 px-6 py-7 border-b border-sidebar-border">
          <div className="w-12 h-12 rounded-2xl bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Crown className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <div className="leading-snug">
            <p className="text-base font-bold text-sidebar-foreground">Chess Play</p>
            <p className="text-xs text-sidebar-foreground/55">Master your Mind</p>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const active = isActivePath(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`w-full flex items-center gap-4 px-5 py-3 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                {label}
              </button>
            );
          })}
        </div>

        {/* User profile + sign out */}
        <div className="border-t border-sidebar-border px-5 py-5 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
              <UserCircle2 className="w-6 h-6 text-sidebar-foreground/70" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.username ?? 'Student'}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{user?.role ?? 'student'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Phone bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg lg:hidden">
        <div className="flex">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const active = isActivePath(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`w-6 h-6 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-xs font-medium ${active ? 'font-semibold' : ''}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
