import { Helmet } from 'react-helmet-async';
import { GameContainer } from '@/components/chess/GameContainer';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Chess Training Platform | Coach-Guided Learning</title>
        <meta name="description" content="Premium chess training platform for coach-guided learning. Improve your game with personalized coaching sessions." />
      </Helmet>
      
      <main className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary-foreground" fill="currentColor">
                  <path d="M19 22H5v-2h14v2M12 2c-1.66 0-3 1.34-3 3 0 .28.04.55.11.8L6.5 10.32c-.34.22-.5.6-.5 1V18c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-6.68c0-.4-.16-.78-.5-1L14.89 5.8c.07-.25.11-.52.11-.8 0-1.66-1.34-3-3-3z"/>
                </svg>
              </div>
              <h1 className="font-semibold text-lg text-foreground">Chess Training</h1>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden sm:inline">Training Session</span>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-600 font-medium">Live</span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="py-6 md:py-10">
          <GameContainer
            playerName="Student"
            coachName="Coach"
            playerColor="white"
            timeControl={{ initial: 600, increment: 0 }}
          />
        </div>

        {/* Footer hint */}
        <footer className="fixed bottom-0 left-0 right-0 py-3 bg-gradient-to-t from-background to-transparent pointer-events-none">
          <p className="text-center text-xs text-muted-foreground">
            Click a piece to see legal moves • Focus on the board
          </p>
        </footer>
      </main>
    </>
  );
};

export default Index;
