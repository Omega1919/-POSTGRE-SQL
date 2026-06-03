import { Database, ChevronDown, ChevronRight, Table as TableIcon, Download, Trash2, FolderOpen, FolderPlus, LogOut, KeyRound, UserPlus, MoreVertical, Plus } from 'lucide-react';
import { useState } from 'react';
import { auth as firebaseAuth } from '../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth as authApi } from '../lib/api';

interface SidebarProps {
  tables: string[];
  folders: { table_name: string, folder_name: string }[];
  projects: any[];
  activeProject: string | null;
  onProjectChange: (name: string | null) => void;
  onProjectCreate: () => void;
  onProjectDelete: (name: string) => void;
  schemas: Record<string, any[]>;
  savedQueries: any[];
  onTableClick: (table: string) => void;
  onColumnClick?: (column: string) => void;
  onQueryClick: (query: string) => void;
  onExportTable: (table: string) => void;
  onDeleteTable: (table: string) => void;
  onMoveTable: (table: string) => void;
  onDeleteQuery: (id: number) => void;
  onLogout: () => void;
  user: any;
}

export default function Sidebar({ 
  tables, folders, projects, activeProject, 
  onProjectChange, onProjectCreate, onProjectDelete,
  schemas, savedQueries, onTableClick, onColumnClick, onQueryClick, 
  onExportTable, onDeleteTable, onMoveTable, onDeleteQuery, onLogout, user 
}: SidebarProps) {
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);

  const toggleTable = (e: any, table: string) => {
    e.stopPropagation();
    setExpandedTables(prev => ({ ...prev, [table]: !prev[table] }));
  };

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ 'ungrouped': true });

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const [isLinking, setIsLinking] = useState(false);
  const [legacyUsername, setLegacyUsername] = useState('');
  const [legacyPassword, setLegacyPassword] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLinkLegacy = async () => {
    if (!legacyUsername || !legacyPassword) return;
    setIsSubmitting(true);
    setLinkError(null);
    try {
      await authApi.linkLegacy({ username: legacyUsername, password: legacyPassword });
      alert('Account linked successfully! Please refresh or wait while data merges.');
      window.location.reload();
    } catch (err: any) {
      setLinkError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedTables: Record<string, string[]> = { 'ungrouped': [] };
  (projects || []).forEach(p => {
    if (p && p.name) {
      groupedTables[p.name] = [];
    }
  });

  (tables || []).forEach(table => {
    const folderMapping = (folders || []).find(f => f && f.table_name === table);
    if (folderMapping && groupedTables[folderMapping.folder_name]) {
      groupedTables[folderMapping.folder_name].push(table);
    } else {
      groupedTables['ungrouped'].push(table);
    }
  });

  const wrapIfNeeded = (name: string) => {
    if (/[A-Z]/.test(name) || /[^a-z0-9_]/.test(name)) return `"${name}"`;
    return name;
  };

  return (
    <aside className="bg-transparent border-r border-primary/10 dark:border-slate-800 p-3 flex flex-col gap-4 overflow-hidden transition-all duration-300 h-full">
      {/* Project Switcher section */}
      <section className="flex flex-col gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 px-1 flex items-center justify-between">
          <span>Namespace</span>
          <div className="flex items-center gap-1">
            {activeProject && (
              <button 
                onClick={(e) => { e.stopPropagation(); onProjectDelete(activeProject); }}
                className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                title="Delete Folder"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button 
              onClick={onProjectCreate}
              className="text-slate-400 hover:text-primary transition-colors p-1"
              title="Create Folder"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          </div>
        </div>
        
        <div className="relative group">
          <select 
            value={activeProject || ''} 
            onChange={(e) => onProjectChange(e.target.value || null)}
            className="w-full bg-white/50 dark:bg-slate-900/50 border border-primary/10 dark:border-slate-800 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none appearance-none cursor-pointer hover:border-primary/40 transition-all pl-9 shadow-sm"
          >
            <option value="">ROOT_DOMAIN</option>
            {(projects || []).map(p => (
              <option key={p.id} value={p.name}>{p?.name?.toUpperCase()}</option>
            ))}
          </select>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/60 pointer-events-none">
             <Database size={14} />
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDown size={12} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2 flex-1 overflow-hidden">
        <div className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Collections
        </div>
        
        <div className="space-y-1 overflow-y-auto pr-1 scrollbar-thin">
          {Object.entries(groupedTables).map(([folderName, folderTables]) => {
            if (activeProject && folderName !== activeProject && folderName !== 'ungrouped') return null;
            if (activeProject && folderName === 'ungrouped' && folderTables.length === 0) return null;
            
            const isUngrouped = folderName === 'ungrouped';
            const isExpanded = expandedFolders[folderName] || false;

            return (
              <div key={folderName} className="flex flex-col gap-0.5">
                <div 
                  onClick={() => toggleFolder(folderName)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all group/folder ${
                    activeProject === folderName 
                      ? 'bg-primary/20 text-primary shadow-sm ring-1 ring-primary/30' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-[#ede9fe] dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="shrink-0 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      <ChevronRight size={14} />
                    </div>
                    <span className="truncate font-black text-[11px] tracking-tight">
                      {isUngrouped ? 'DEFAULT' : folderName.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60">[{folderTables.length}]</span>
                </div>

                {isExpanded && (
                  <div className="ml-3 border-l-2 border-[#ede9fe] dark:border-slate-800/60 pl-3 space-y-px mt-0.5">
                    {folderTables.map(table => (
                      <div key={table} className="flex flex-col">
                        <div 
                          className="group/table text-[12px] px-2 py-2 rounded-md hover:bg-[#ede9fe] dark:hover:bg-slate-900 hover:text-primary dark:hover:text-white cursor-pointer flex items-center justify-between transition-all relative"
                        >
                          <div className="flex items-center gap-2 truncate flex-1" onClick={() => onTableClick(table)}>
                            <TableIcon size={12} className="shrink-0 opacity-40 group-hover/table:opacity-100" />
                            <span className="truncate font-semibold">{table}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="relative">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMenuPosition({ top: rect.bottom, left: rect.right });
                                  setOpenMenu(openMenu === table ? null : table);
                                }}
                                className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md text-slate-400 opacity-0 group-hover/table:opacity-100 shadow-sm transition-all"
                                title="Actions"
                              >
                                <MoreVertical size={12} />
                              </button>
                              
                              {openMenu === table && menuPosition && (
                                <>
                                  <div className="fixed inset-0 z-[110]" onClick={() => setOpenMenu(null)}></div>
                                  <div 
                                    className="fixed w-40 bg-white dark:bg-slate-900 border border-primary/20 dark:border-slate-800 rounded-xl shadow-2xl z-[120] py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                                    style={{ 
                                      top: menuPosition.top + 5, 
                                      left: menuPosition.left - 160,
                                      // If near bottom of screen, show above
                                      ...(menuPosition.top > window.innerHeight - 150 ? {
                                        top: 'auto',
                                        bottom: window.innerHeight - menuPosition.top + 25
                                      } : {})
                                    }}
                                  >
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); onExportTable(table); setOpenMenu(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-primary/5 hover:text-primary transition-colors uppercase tracking-widest text-left"
                                    >
                                      <Download size={12} /> Export CSV
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); onMoveTable(table); setOpenMenu(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-primary/5 hover:text-primary transition-colors uppercase tracking-widest text-left"
                                    >
                                      <FolderOpen size={12} /> Move to Folder
                                    </button>
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); onDeleteTable(table); setOpenMenu(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-bold text-rose-500 hover:bg-rose-500 hover:text-white transition-colors uppercase tracking-widest text-left"
                                    >
                                      <Trash2 size={12} /> Delete Table
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                            <button 
                              onClick={(e) => toggleTable(e, table)}
                              className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md text-slate-400 opacity-0 group-hover/table:opacity-100 shadow-sm transition-all"
                            >
                              {expandedTables[table] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                          </div>
                        </div>
                        {expandedTables[table] && (
                          <div className="ml-2 flex flex-col gap-0.5 border-l border-primary/10 dark:border-slate-800 pl-3 pb-1.5 animate-in slide-in-from-left-1 duration-200">
                            {schemas[table]?.map((col: any) => (
                              <div 
                                key={col.Field} 
                                onClick={() => onColumnClick?.(wrapIfNeeded(col.Field))}
                                className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 py-1 hover:text-secondary group/col transition-all cursor-pointer"
                              >
                                <span className="truncate">{col.Field}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center justify-between">
          Favorites
          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">
            {(savedQueries || []).length}
          </span>
        </div>
        <div className="space-y-1.5 overflow-y-auto max-h-[15vh] pr-1 scrollbar-thin">
          {(savedQueries || []).map(sq => (
            <div
              key={sq.id}
              onClick={() => onQueryClick(sq.query)}
              className="px-3 py-2.5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-primary/20 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white hover:border-primary/40 cursor-pointer flex items-center justify-between group transition-all shadow-sm"
            >
              <div className="flex items-center gap-3 truncate">
                <span className="text-amber-500 shrink-0 text-xs">★</span>
                <span className="truncate font-bold text-[12px]">{sq.name}</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteQuery(sq.id); }}
                className="p-1.5 hover:bg-rose-500 hover:text-white rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                title="Delete Query"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-auto pt-4 border-t border-primary/10 dark:border-slate-800 flex flex-col gap-4">
        <button 
          onClick={() => setIsLinking(!isLinking)}
          className="flex items-center gap-3 px-1 group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shadow-sm">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col truncate flex-1 items-start">
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">{user?.username}</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Account</span>
          </div>
        </button>
      </section>
    </aside>
  );
}
