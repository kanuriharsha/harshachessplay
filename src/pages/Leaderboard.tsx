import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Loader2, Sparkles } from 'lucide-react';
import BottomNav from '../components/BottomNav';

interface LeaderboardEntry {
  position: number;
  userId: string | null;
  username: string;
  fullName?: string;
}

interface LeaderboardBanner {
  enabled: boolean;
  playerName: string;
}

const MEDAL = [
  {
    pos: 1,
    label: '1st Place',
    emoji: '🥇',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-400',
    text: 'text-yellow-600 dark:text-yellow-400',
    size: 'text-5xl',
    ring: 'ring-4 ring-yellow-400',
  },
  {
    pos: 2,
    label: '2nd Place',
    emoji: '🥈',
    bg: 'bg-gray-50 dark:bg-gray-800/20',
    border: 'border-gray-400',
    text: 'text-gray-500 dark:text-gray-300',
    size: 'text-5xl',
    ring: 'ring-4 ring-gray-400',
  },
  {
    pos: 3,
    label: '3rd Place',
    emoji: '🥉',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-400',
    text: 'text-orange-600 dark:text-orange-400',
    size: 'text-5xl',
    ring: 'ring-4 ring-orange-400',
  },
];

const getOrdinalSuffix = (num: number) => {
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  switch (num % 10) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
};

const Leaderboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [banner, setBanner] = useState<LeaderboardBanner>({ enabled: false, playerName: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  const fetchLeaderboard = async () => {
    try {
      const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${API}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setBanner({
          enabled: Boolean(data?.banner?.enabled),
          playerName: typeof data?.banner?.playerName === 'string' ? data.banner.playerName : '',
        });
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const getEntry = (pos: number): LeaderboardEntry | undefined =>
    entries.find((e) => e.position === pos);

  const getDisplayName = (entry?: LeaderboardEntry) =>
    entry?.fullName?.trim() || entry?.username || '';

  const bannerPlayerName = banner.playerName.trim() || getDisplayName(getEntry(1)) || 'Champion';

  const additionalEntries = entries
    .filter((entry) => entry.position >= 4)
    .sort((a, b) => a.position - b.position);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pl-[17rem] lg:pb-4">
      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Leaderboard</h1>
            <p className="text-sm text-muted-foreground">Top players this season</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {banner.enabled && (
              <div className="mb-6 rounded-2xl border bg-primary/10 border-primary/30 p-4 text-center banner-shine">
                <div className="flex items-center justify-center gap-2 text-primary mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Congratulations</span>
                  <Sparkles className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-foreground">
                  Congratulations to the Best Player{' '}
                  <span className="inline-block rounded-md bg-primary/15 px-2 py-0.5 text-primary">
                    {bannerPlayerName}
                  </span>
                </p>
              </div>
            )}

            {/* Podium
                Mobile:  1st full-width on top, then 2nd & 3rd side-by-side
                Desktop: all three in one equal-width row
            */}
            {/* Podium — all three equal size always */}
            <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-3">
              {MEDAL.map((m) => {
                const entry = getEntry(m.pos);
                return (
                  <div
                    key={m.pos}
                    className={`${
                      m.pos === 1 ? 'col-span-2 lg:col-span-1' : ''
                    } rounded-2xl border-2 ${m.border} ${m.bg} p-5 flex flex-col items-center shadow`}
                  >
                    <span className={`${m.size} mb-2`}>{m.emoji}</span>
                    <span className={`font-bold text-base ${m.text}`}>{m.label}</span>
                    {getDisplayName(entry) ? (
                      <span className="mt-2 text-base font-semibold text-foreground text-center">
                        {getDisplayName(entry)}
                      </span>
                    ) : (
                      <span className="mt-2 text-muted-foreground italic text-sm">Not assigned</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* List view from 4th place onward */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Rankings (4th and below)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {additionalEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No additional rankings yet.</p>
                ) : (
                  additionalEntries.map((entry) => (
                    <div
                      key={entry.position}
                      className="flex items-center gap-4 p-3 rounded-xl border bg-card"
                    >
                      <span className="text-base font-semibold text-muted-foreground min-w-12 text-center">
                        #{entry.position}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{getOrdinalSuffix(entry.position)} Place</p>
                        <p className="text-sm text-foreground">
                          {getDisplayName(entry) || <span className="italic text-muted-foreground">TBD</span>}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Leaderboard;
