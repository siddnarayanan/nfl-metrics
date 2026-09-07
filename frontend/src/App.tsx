import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { LeaderboardPage } from "./pages/LeaderboardPage.js";
import { TeamPage } from "./pages/TeamPage.js";
import { ComparePage } from "./pages/ComparePage.js";
import { PredictionsPage } from "./pages/PredictionsPage.js";
import { PlayersPage } from "./pages/PlayersPage.js";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LeaderboardPage />} />
        <Route path="teams/:abbreviation" element={<TeamPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="predictions" element={<PredictionsPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
