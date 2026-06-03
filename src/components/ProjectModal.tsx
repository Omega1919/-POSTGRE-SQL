import { X, FolderPlus } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

interface ProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProjectModal({ onClose, onSuccess }: ProjectModalProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      await db.createProject(name.trim());
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-md bg-[#f5f3ff] dark:bg-slate-900 border border-primary/20 dark:border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-primary/10 dark:border-slate-800 bg-[#ede9fe]/50 dark:bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <FolderPlus size={20} strokeWidth={2.5} />
              </div>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">New Folder</h2>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6">
            <div className="space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1">
                Folder Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Sales Data"
                className="w-full px-5 py-4 bg-white dark:bg-slate-950 border border-primary/10 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-primary outline-none transition-all"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 ml-1 font-mono leading-relaxed opacity-60">
                INFO: CREATE A NEW FOLDER TO ORGANIZE YOUR DATA TABLES.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-xl text-rose-500 text-xs font-bold">
                Error: {error}
              </div>
            )}

            <div className="flex justify-end gap-4 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="px-8 py-4 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary-hover disabled:opacity-30 transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                {isLoading ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
