import { lazy, Suspense } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAppData } from './db/hooks';
import { AppContext, useApp } from './AppContext';
import { cx } from './components/ui';
import { useReminders } from './lib/reminders';
import { dayNumber } from './lib/rules';
import Onboarding from './pages/Onboarding';
import DayView from './pages/DayView';
import Calendar from './pages/Calendar';
import Photos from './pages/Photos';
import More from './pages/More';

// Charts are the heaviest dependency – load them only when the Progress tab opens.
const Progress = lazy(() => import('./pages/Progress'));

const TABS = [
  { to: '/', label: 'Today', icon: '✅' },
  { to: '/calendar', label: 'Calendar', icon: '📅' },
  { to: '/progress', label: 'Progress', icon: '📈' },
  { to: '/photos', label: 'Photos', icon: '📸' },
  { to: '/more', label: 'More', icon: '☰' },
];

function NewChallenge() {
  const app = useApp();
  const navigate = useNavigate();
  const prev = app.challenge;
  return (
    <Onboarding
      settings={app.settings}
      previous={prev && { type: prev.type, config: prev.config, attempt: prev.attempt }}
      onCancel={() => navigate('/')}
      onDone={() => navigate('/')}
    />
  );
}

export default function App() {
  const app = useAppData();
  const { challenge, evaluation, today } = app;
  const day = challenge ? dayNumber(challenge.startDate, today) : 0;
  const todayTasks = evaluation && day >= 1 && day <= 75 && challenge?.status === 'active' ? evaluation.days[day - 1].tasks : undefined;
  const { toast, dismiss } = useReminders(app.settings.reminders, app.now, todayTasks);

  if (app.loading) return <div className="min-h-screen" />;
  if (!challenge) return <Onboarding settings={app.settings} />;

  return (
    <AppContext.Provider value={app}>
      <Routes>
        <Route path="/new" element={<NewChallenge />} />
        <Route
          path="*"
          element={
            <div className="min-h-screen pb-24">
              <main className="mx-auto max-w-lg px-4 pt-6 pt-safe">
                <Routes>
                  <Route path="/" element={<DayView />} />
                  <Route path="/day/:date" element={<DayView />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/progress" element={<Suspense fallback={null}><Progress /></Suspense>} />
                  <Route path="/photos" element={<Photos />} />
                  <Route path="/more" element={<More />} />
                </Routes>
              </main>
              <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur pb-safe">
                <div className="mx-auto max-w-lg grid grid-cols-5">
                  {TABS.map((t) => (
                    <NavLink key={t.to} to={t.to} end={t.to === '/'}
                      className={({ isActive }) => cx('flex flex-col items-center py-2.5 text-xs', isActive ? 'text-orange-400' : 'text-slate-400')}>
                      <span className="text-lg leading-none mb-1">{t.icon}</span>
                      {t.label}
                    </NavLink>
                  ))}
                </div>
              </nav>
              {toast && (
                <div className="fixed top-4 inset-x-4 z-50 mx-auto max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-4 shadow-xl" role="alert">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{toast.title}</div>
                      <div className="text-sm text-slate-300">{toast.body}</div>
                    </div>
                    <button onClick={dismiss} className="text-slate-400" aria-label="Dismiss">✕</button>
                  </div>
                </div>
              )}
            </div>
          }
        />
      </Routes>
    </AppContext.Provider>
  );
}
