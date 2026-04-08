import React, { useState } from 'react';
import { Eye, LockKeyhole, LogIn, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { error, dismissError, loginEditor, loginViewer } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditorLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    dismissError();

    try {
      await loginEditor(username, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewerLogin = async () => {
    setIsSubmitting(true);
    dismissError();

    try {
      await loginViewer();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#e2e8f0)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="flex w-full flex-col justify-between gap-8 bg-slate-900 px-8 py-10 text-white md:w-[42%]">
          <div>
            <img
              src="/images/B.png"
              alt="Bangkok Hospital Chanthaburi"
              className="h-16 w-16 object-contain"
            />
            <h1 className="mt-8 text-3xl font-black tracking-tight">BCH Product Monitor</h1>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-300">
              Sign in as an Editor to manage data, or continue as a Viewer for read-only access.
            </p>
          </div>

          <div className="space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="font-bold text-white">Default Editor Login</div>
              <div className="mt-2">Username: <span className="font-semibold text-slate-100">editor</span></div>
              <div>Password: <span className="font-semibold text-slate-100">ChangeMe123!</span></div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center px-6 py-10 md:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-500">Choose how you want to enter the workspace.</p>
            </div>

            {error ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleEditorLogin} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <LockKeyhole size={18} />
                <h3 className="text-lg font-bold">Editor Login</h3>
              </div>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  <UserRound size={13} />
                  Username
                </span>
                <input
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  <LockKeyhole size={13} />
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogIn size={16} />
                Sign in as Editor
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              onClick={() => void handleViewerLogin()}
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Eye size={16} />
              View as Viewer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
