import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AlertCircle } from 'lucide-react';

const LoginView: React.FC = () => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      setLoading(provider);
      setErrorMsg(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(`${provider} Login error:`, err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials or configuration.');
      setLoading(null);
    }
  };


  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] relative overflow-hidden px-4 select-none">
      {/* Dynamic Background Art */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-pulse duration-[8000ms]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-brand-emerald/10 blur-[100px] pointer-events-none animate-pulse duration-[6000ms]"></div>

      {/* Main Glassmorphic Container */}
      <div className="w-full max-w-md bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-8 backdrop-blur-2xl shadow-2xl relative z-10 flex flex-col items-center">
        {/* App Logo & Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-brand-emerald flex items-center justify-center shadow-lg shadow-indigo-500/15">
            <svg className="w-5 h-5 text-zinc-950 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <span className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400">remindMeUp</span>
        </div>

        <h2 className="text-lg font-semibold text-zinc-200 text-center mb-1">Welcome to the future of task planning</h2>
        <p className="text-xs text-zinc-500 text-center mb-8">Sign in with your preferred platform to begin synchronization</p>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="w-full flex items-center gap-2.5 p-3 mb-5 text-xs text-brand-crimson bg-brand-crimson/5 border border-brand-crimson/20 rounded-lg">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3.5">
          {/* Google Button */}
          <button
            onClick={() => handleOAuthLogin('google')}
            disabled={loading !== null}
            className="w-full py-3 px-4 rounded-xl border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800/40 text-sm font-semibold text-zinc-200 transition-all flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {loading === 'google' ? (
              <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* GitHub Button */}
          <button
            onClick={() => handleOAuthLogin('github')}
            disabled={loading !== null}
            className="w-full py-3 px-4 rounded-xl border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800/40 text-sm font-semibold text-zinc-200 transition-all flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {loading === 'github' ? (
              <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            )}
            <span>Continue with GitHub</span>
          </button>


        </div>

        {/* Footer info */}
        <p className="text-[10px] text-zinc-600 text-center mt-8 leading-relaxed max-w-[280px]">
          By continuing, you agree to remindMeUp's terms of service and dynamic resource usage agreements.
        </p>
      </div>
    </div>
  );
};

export default LoginView;
