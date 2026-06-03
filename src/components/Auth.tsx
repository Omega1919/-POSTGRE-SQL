import React, { useState, FormEvent } from 'react';
import { Database, Loader2, ArrowRight } from 'lucide-react';
import { signInWithGoogle, auth as firebaseAuth } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';

interface AuthProps {
  onSuccess: (user: any) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (isResetMode) {
        await sendPasswordResetEmail(firebaseAuth, email);
        setError('Password reset email sent. Check your inbox.');
        setIsResetMode(false);
      } else if (isLogin) {
        const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
        onSuccess({
          uid: result.user.uid,
          username: result.user.displayName || result.user.email?.split('@')[0],
        });
      } else {
        const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (displayName) {
          await updateProfile(result.user, { displayName });
        }
        onSuccess({
          uid: result.user.uid,
          username: displayName || result.user.email?.split('@')[0],
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      onSuccess({
        uid: user.uid,
        username: user.displayName || user.email?.split('@')[0],
      });
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, don't show an error message
        return;
      }
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f3ff] dark:bg-slate-950 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden transition-colors duration-500">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 dark:bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 dark:bg-secondary/10 rounded-full blur-[120px] animate-pulse delay-700"></div>
      
      <div className="w-full max-w-[440px] relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-5 text-slate-900 dark:text-white mb-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-primary via-secondary to-accent flex items-center justify-center rounded-2xl shadow-2xl shadow-primary/30 rotate-6 group hover:rotate-0 transition-all duration-500">
              <Database size={32} className="text-white -rotate-6 group-hover:rotate-0 transition-all" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter">
              Data<span className="text-primary italic">Studio</span>
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] opacity-60">Connected Workspace Login</p>
        </div>

        <div className="bg-[#fdfcff] dark:bg-slate-900 p-10 rounded-3xl shadow-xl dark:shadow-none border border-primary/20 dark:border-white/5 relative overflow-hidden">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold py-4 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 border border-primary/20 dark:border-slate-700 group shadow-sm hover:shadow-md active:scale-[0.98] mb-8"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" />
            Sign in with Google
          </button>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary/10 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[9px] uppercase font-bold tracking-[0.3em]">
              <span className="bg-[#fdfcff] dark:bg-slate-900 px-4 text-slate-500 dark:text-slate-400">Or use email</span>
            </div>
          </div>

          <div className="flex gap-2 p-1.5 bg-[#ede9fe] dark:bg-black/20 rounded-2xl border border-primary/10 dark:border-white/5 mb-8">
            <button
              onClick={() => { setIsLogin(true); setIsResetMode(false); }}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-300 ${
                isLogin && !isResetMode ? 'bg-[#fdfcff] dark:bg-slate-800 text-primary shadow-sm ring-1 ring-primary/20 dark:ring-white/5' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setIsResetMode(false); }}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-300 ${
                !isLogin && !isResetMode ? 'bg-[#fdfcff] dark:bg-slate-800 text-primary shadow-sm ring-1 ring-primary/20 dark:ring-white/5' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && !isResetMode && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-5 py-4 bg-[#f5f3ff] dark:bg-slate-800/50 border border-primary/10 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                  placeholder="Your Name"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-[#f5f3ff] dark:bg-slate-800/50 border border-primary/10 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                placeholder="name@example.com"
              />
            </div>
            {!isResetMode && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-[#f5f3ff] dark:bg-slate-800/50 border border-primary/10 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/10 text-rose-500 text-xs font-bold rounded-xl border border-rose-100 dark:border-rose-900/20 shadow-sm animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-primary/25 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isResetMode ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Create Account')}
                  <ArrowRight className="w-4 h-4" strokeWidth={3} />
                </>
              )}
            </button>

            {isLogin && !isResetMode && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsResetMode(true)}
                  className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-primary font-bold uppercase tracking-widest transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </form>
        </div>

        <p className="mt-12 text-center text-[9px] text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em] font-bold opacity-60">
          Secure Cloud Database Management
        </p>
      </div>
    </div>
  );
}

