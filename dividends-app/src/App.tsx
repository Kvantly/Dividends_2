import { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { StockView } from './components/StockView';

type View = 'home' | 'stock';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="container">
      <Header theme={theme} onToggleTheme={toggleTheme} />

      {view === 'home' && <HomeView onGetPick={() => setView('stock')} />}
      {view === 'stock' && <StockView onBack={() => setView('home')} />}

      <footer>
        <p>© {new Date().getFullYear()} StockAI · Data refreshed weekly</p>
      </footer>
    </div>
  );
}
