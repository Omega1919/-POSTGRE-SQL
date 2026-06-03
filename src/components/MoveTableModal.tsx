import { X, FolderPlus, Folder, Database, Search, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

interface MoveTableModalProps {
  tableName: string;
  currentFolder: string;
  projects: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function MoveTableModal({ tableName, currentFolder, projects, onClose, onSuccess }: MoveTableModalProps) {
  const [search, setSearch] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProjects = (projects || []).filter(p => 
    p && p.name && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleMove = async (folderName: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      await db.updateTableFolder(tableName, folderName);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to move table');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAndMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      await db.updateTableFolder(tableName, newProjectName.trim());
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create and move');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#ede9fe]/80 dark:bg-slate-950/80 backdrop-blur-md">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-md bg-[#f5f3ff] dark:bg-slate-900 border border-primary/20 dark:border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          <div className="p-8 border-b border-primary/10 dark:border-slate-800 bg-[#ede9fe]/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <FolderPlus size={20} strokeWidth={2.5} />
                </div>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Move Table</h2>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 font-mono uppercase tracking-widest opacity-60">TARGET: <span className="text-primary font-bold">{tableName}</span></p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-8 flex flex-col gap-6 overflow-y-auto scrollbar-thin">
            {!isCreating ? (
              <>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search folders..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-primary/10 dark:border-slate-800 rounded-xl pl-11 pr-5 py-4 text-sm font-bold text-slate-900 dark:text-white focus:border-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1 mb-3">
                    Target Folder
                  </div>
                  
                  <button
                    onClick={() => handleMove(null)}
                    className={`w-full flex items-center justify-between px-5 py-5 rounded-[1.2rem] text-xs transition-all group border ${
                      !currentFolder ? 'bg-primary/10 border-primary/20 text-primary ring-2 ring-primary/5' : 'bg-white dark:bg-slate-950 border-transparent text-slate-600 dark:text-slate-400 hover:bg-[#ede9fe]/50 dark:hover:bg-white/5 hover:border-primary/20 dark:hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Database size={18} className={!currentFolder ? 'text-primary' : 'text-slate-400'} />
                      <span className="font-bold uppercase tracking-widest">Root Folder</span>
                    </div>
                    {!currentFolder && <div className="w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/50" />}
                  </button>

                  <div className="space-y-1.5">
                    {filteredProjects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => handleMove(project.name)}
                        disabled={isLoading}
                        className={`w-full flex items-center justify-between px-5 py-5 rounded-[1.2rem] text-xs transition-all group border ${
                          currentFolder === project.name ? 'bg-primary/10 border-primary/20 text-primary ring-2 ring-primary/5' : 'bg-white dark:bg-slate-950 border-transparent text-slate-600 dark:text-slate-400 hover:bg-[#ede9fe]/50 dark:hover:bg-white/5 hover:border-primary/20 dark:hover:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Folder size={18} className={currentFolder === project.name ? 'text-primary' : 'text-slate-400'} />
                          <span className="font-bold uppercase tracking-widest">{project.name}</span>
                        </div>
                        {currentFolder === project.name && <div className="w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/50" />}
                      </button>
                    ))}
                  </div>

                  {filteredProjects.length === 0 && search && (
                    <div className="text-center py-10 opacity-20 flex flex-col items-center gap-3">
                      <Search size={32} />
                      <p className="text-[10px] font-bold uppercase tracking-widest italic">No matching folders</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-2">
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center justify-center gap-3 py-5 rounded-[1.2rem] border-2 border-dashed border-primary/10 dark:border-slate-800 hover:border-primary hover:bg-primary/5 text-slate-400 hover:text-primary font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                  >
                    <Plus size={16} strokeWidth={3} />
                    Create New Folder
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleCreateAndMove} className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1">
                    Folder Name
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="E.g. Analytics Data"
                    className="w-full px-5 py-4 bg-white dark:bg-slate-950 border border-primary/10 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-primary outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  >
                    Back to List
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !newProjectName.trim()}
                    className="flex-[2] bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary-hover transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20 active:scale-95"
                  >
                    {isLoading ? 'Wait...' : 'Create & Move'}
                  </button>
                </div>
              </form>
            )}

            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-xl text-rose-500 text-xs font-bold">
                Error: {error}
              </div>
            )}
          </div>

          <div className="p-8 bg-[#ede9fe]/30 dark:bg-slate-900/50 border-t border-primary/10 dark:border-slate-800 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Support Plus icon for use above

