import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import TeamView from './pages/TeamView';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/t/:slug" element={<TeamView />} />
    </Routes>
  );
}
