import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import TeamView from './pages/TeamView';
import PlayersPage from './pages/PlayersPage';
import PlayerProfilePage from './pages/PlayerProfilePage';
import SessionsPage from './pages/SessionsPage';
import PayPage from './pages/PayPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/player/:slug" element={<PlayerProfilePage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/pay" element={<PayPage />} />
        <Route path="/t/:slug" element={<TeamView />} />
      </Route>
    </Routes>
  );
}
