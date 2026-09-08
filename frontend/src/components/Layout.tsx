import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle.js";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive
      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            NFL Efficiency Dashboard
          </span>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Leaderboard
            </NavLink>
            <NavLink to="/compare" className={navLinkClass}>
              Compare
            </NavLink>
            <NavLink to="/players" className={navLinkClass}>
              Players
            </NavLink>
            <NavLink to="/predictions" className={navLinkClass}>
              Predictions
            </NavLink>
          </nav>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
