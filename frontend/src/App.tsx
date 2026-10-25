import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { AppShell, RequireAuth } from "./components/Layout";
import { AdminLayout } from "./components/admin/AdminSidebar";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { EmptyState } from "./components/EmptyState";
import { useT } from "./i18n";
import Landing from "./pages/Landing";
import Games from "./pages/Games";
import GameDetail from "./pages/GameDetail";
import Leaderboard from "./pages/Leaderboard";
import { About, Privacy, ResponsiblePlayPage, Terms } from "./pages/Info";
import { Login, Register } from "./pages/AuthPages";
import Dashboard from "./pages/Dashboard";
import Play from "./pages/Play";
import Wallet from "./pages/Wallet";
import { Achievements, History, Missions } from "./pages/Progress";
import { Profile } from "./pages/Profile";
import Settings from "./pages/Settings";

// Halaman berat (grafik Recharts, admin) dimuat saat dibutuhkan.
const Statistics = lazy(() => import("./pages/Statistics"));
const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminGames = lazy(() => import("./pages/admin/Games"));
const AdminEconomy = lazy(() => import("./pages/admin/Economy"));
const AdminMissions = lazy(() => import("./pages/admin/Missions"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminAudit = lazy(() => import("./pages/admin/Audit"));

function NotFound() {
  const t = useT();
  return <EmptyState title={t("notFound.title")} text={t("notFound.text")} action={<Link to="/" className="btn btn-primary">{t("nav.home")}</Link>} />;
}
const L = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<LoadingSkeleton rows={3} height={120} />}>{children}</Suspense>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* Publik */}
          <Route index element={<Landing />} />
          <Route path="games" element={<Games />} />
          <Route path="games/:slug" element={<GameDetail />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="about" element={<About />} />
          <Route path="responsible-play" element={<ResponsiblePlayPage />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />

          {/* Terautentikasi (pelindung klien = UX saja; server memeriksa ulang di setiap API) */}
          <Route element={<RequireAuth />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="play/:slug" element={<Play />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="missions" element={<Missions />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="history" element={<History />} />
            <Route path="statistics" element={<L><Statistics /></L>} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Admin */}
          <Route element={<RequireAuth admin />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<L><AdminOverview /></L>} />
              <Route path="users" element={<L><AdminUsers /></L>} />
              <Route path="games" element={<L><AdminGames /></L>} />
              <Route path="economy" element={<L><AdminEconomy /></L>} />
              <Route path="missions" element={<L><AdminMissions /></L>} />
              <Route path="analytics" element={<L><AdminAnalytics /></L>} />
              <Route path="audit-logs" element={<L><AdminAudit /></L>} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
