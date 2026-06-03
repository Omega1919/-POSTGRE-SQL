import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import SQLEditor from './components/SQLEditor';
import DataGrid from './components/DataGrid';
import Visualizer from './components/Visualizer';
import ImportModal from './components/ImportModal';
import InsightsPanel from './components/InsightsPanel';
import Auth from './components/Auth';
import ProjectModal from './components/ProjectModal';
import MoveTableModal from './components/MoveTableModal';
import TypingTrainer from './components/TypingTrainer';
import { db, auth as authApi } from './lib/api';
import { auth as firebaseAuth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Plus, LayoutGrid, BarChart3, Moon, Sun, Table2, Trash2, Play, MessageSquareQuote, Download, Copy, Check, X, AlertCircle, LogOut, Loader2, Database, Sparkles, Keyboard } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [activeMainTab, setActiveMainTab] = useState<'explorer' | 'typing'>('explorer');
  const [tables, setTables] = useState<string[]>([]);
  const [folders, setFolders] = useState<{ table_name: string, folder_name: string }[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [sql, setSql] = useState('-- Select data from imported schemas\nSELECT * FROM sample_table LIMIT 10;');
  const [results, setResults] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [executionTime, setExecutionTime] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'viz'>('grid');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [movingTable, setMovingTable] = useState<{ name: string; currentFolder: string } | null>(null);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [pendingInsightContent, setPendingInsightContent] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [schemas, setSchemas] = useState<Record<string, any[]>>({});
  const [copyingHistoryId, setCopyingHistoryId] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        // We still use local state to trigger fetchData, 
        // but now our API calls will fetch real tokens from Firebase
        setUser({
          uid: firebaseUser.uid,
          username: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          email: firebaseUser.email,
        });
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [tRes, sqRes, pRes, hRes] = await Promise.all([
        db.getTables(),
        db.getSavedQueries(),
        db.getProjects(),
        db.getHistory(),
      ]);
      setTables(tRes?.tables || []);
      setFolders(tRes?.folders || []);
      setProjects(pRes?.projects || []);
      setSavedQueries(sqRes?.queries || []);
      if (hRes && typeof hRes === 'object' && hRes.history) {
        setHistory(hRes.history || []);
      } else {
        setHistory([]);
      }

      // Fetch individual schemas for columns
      const schemaPromises = (tRes?.tables || []).map(async (table: string) => {
        try {
          const sRes = await db.getTableSchema(table);
          // Use literal column names from the database
          return { table, schema: sRes?.schema || [] };
        } catch (e) {
          return { table, schema: [] };
        }
      });
      const schemaResults = await Promise.all(schemaPromises);
      const schemaMap: Record<string, any[]> = {};
      schemaResults.forEach(res => {
        schemaMap[res.table] = res.schema;
      });
      setSchemas(schemaMap);
    } catch (err: any) {
      console.error('Failed to fetch initial data:', err);
      if (err.message === 'Unauthorized') {
        authApi.logout();
      } else {
        setError(err.message || 'Failed to fetch initial data');
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleRunQuery = async () => {
    setIsLoading(true);
    setError(null);
    setIsInsightsOpen(false); // Close insights when running a query
    setView('grid'); // Always ensure we are in grid view when running
    try {
      const res = await db.runQuery(sql);
      setResults(res.results);
      setFields(res.fields);
      setExecutionTime(res.executionTime);
      
      // Refresh history after a successful or failed run
      const hRes = await db.getHistory();
      if (hRes && typeof hRes === 'object' && hRes.history) {
        setHistory(hRes.history);
      }

      // Check if the query is a mutating statement (DML/DDL) and reload sidebar schema/tables
      const upperSql = sql.toUpperCase();
      const isMutation = /\b(ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|TRUNCATE|RENAME|COPY)\b/i.test(upperSql);
      if (isMutation) {
        await fetchData();
      }
    } catch (err: any) {
      setError(err.message);
      setResults([]);
      
      // Still refresh history on error to show the failed attempt
      try {
        const hRes = await db.getHistory();
        if (hRes && typeof hRes === 'object' && hRes.history) {
          setHistory(hRes.history);
        }
      } catch (hErr) {
        console.error('Failed to fetch history after error:', hErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveQuery = async () => {
    const name = window.prompt('Enter a name for this query:');
    if (!name) return;
    try {
      await db.saveQuery(name, sql);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const downloadCSV = (data: any[], fieldsList: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const columns = fieldsList.map(f => f.name || f);
    const csvRows = [
      columns.map(col => `"${String(col).replace(/"/g, '""')}"`).join(','),
      ...data.map(row => columns.map(col => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    downloadCSV(results, fields, 'query_results');
  };

  const handleCopyResults = async () => {
    if (!results || results.length === 0) return;
    try {
      const columns = fields.map(f => f.name || f);
      
      // Plain text (TSV) for simple editors
      const plainText = [
        columns.join('\t'),
        ...results.map(row => columns.map(col => String(row[col] ?? '')).join('\t'))
      ].join('\n');

      // HTML table for spreadsheets and rich text editors
      const htmlTable = `
        <table border="1" style="border-collapse: collapse; font-family: sans-serif; font-size: 14px; width: 100%;">
          <thead>
            <tr style="background-color: #1e293b; color: white;">
              ${columns.map(col => `<th style="padding: 10px; text-align: left; border: 1px solid #475569;">${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${results.map(row => `
              <tr>
                ${columns.map(col => `<td style="padding: 8px; border: 1px solid #e2e8f0; color: #334155;">${String(row[col] ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      const typeText = "text/plain";
      const typeHtml = "text/html";
      const blobText = new Blob([plainText], { type: typeText });
      const blobHtml = new Blob([htmlTable], { type: typeHtml });
      
      const data = [new ClipboardItem({
        [typeText]: blobText,
        [typeHtml]: blobHtml
      })];

      await navigator.clipboard.write(data);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch (err) {
      console.error('Failed to copy rich table:', err);
      // Fallback to plain text only
      try {
        const columns = fields.map(f => f.name || f);
        const text = [
          columns.join('\t'),
          ...results.map(row => columns.map(col => String(row[col] ?? '')).join('\t'))
        ].join('\n');
        await navigator.clipboard.writeText(text);
        setCopying(true);
        setTimeout(() => setCopying(false), 2000);
      } catch (fallbackErr) {
        console.error('Copy failed completely:', fallbackErr);
      }
    }
  };

  const handleExportTable = async (table: string) => {
    setIsLoading(true);
    try {
      // Fetch entire table
      const res = await db.runQuery(`SELECT * FROM "${table}";`);
      downloadCSV(res.results, res.fields, `table_export_${table}`);
    } catch (err: any) {
      alert(`Failed to export table: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTable = async (tableName: string) => {
    if (!window.confirm(`Are you sure you want to permanently DELETE the table "${tableName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await db.deleteTable(tableName);
      await fetchData();
      setResults([]);
      setFields([]);
      setError(null);
    } catch (err: any) {
      alert(`Failed to delete table: ${err.message}`);
    }
  };

  const handleDeleteQuery = async (id: number) => {
    if (!window.confirm('Delete this saved query?')) return;
    try {
      await db.deleteQuery(id);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMoveTable = (tableName: string) => {
    const currentFolder = folders.find(f => f.table_name === tableName)?.folder_name || '';
    setMovingTable({ name: tableName, currentFolder });
  };

  const handleCreateProject = () => {
    setIsProjectModalOpen(true);
  };

  const handleDeleteProject = async (name: string) => {
    if (!window.confirm(`Delete project "${name}"? Tables will become ungrouped.`)) return;
    try {
      await db.deleteProject(name);
      if (activeProject === name) setActiveProject(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTableClick = (tableName: string) => {
    const wrapIfNeeded = (name: string) => {
      if (/[A-Z]/.test(name) || /[^a-z0-9_]/.test(name)) return `"${name}"`;
      return name;
    };
    const wrapped = wrapIfNeeded(tableName);
    
    if (!sql || sql.trim() === '' || sql === '-- Select data from imported schemas\nSELECT * FROM sample_table LIMIT 10;') {
      setSql(`SELECT * FROM ${wrapped} LIMIT 100;`);
    } else {
      setSql(prev => {
        const lastChar = prev.trim().slice(-1);
        const needsSpace = lastChar !== '' && lastChar !== '(' && lastChar !== ',';
        return prev + (needsSpace ? ' ' : '') + wrapped;
      });
    }
  };

  const handleColumnClick = (columnName: string) => {
    setSql(prev => {
      const lastChar = prev.trim().slice(-1);
      const needsSpace = lastChar !== '' && lastChar !== '(' && lastChar !== ',' && lastChar !== '*';
      return prev + (needsSpace ? ' ' : '') + columnName;
    });
  };

  const handleCopyQuery = async (e: React.MouseEvent, query: string, id: number) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(query);
      setCopyingHistoryId(id);
      setTimeout(() => setCopyingHistoryId(null), 2000);
    } catch (err) {
      console.error('Failed to copy query:', err);
    }
  };

  const handleSendToInsights = () => {
    if (!results || results.length === 0) return;
    
    const columns = fields.map(f => f.name || f);
    
    // HTML table for rich text editor
    const htmlTable = `
      <div class="query-insight-block">
        <p><strong>Query Results: ${new Date().toLocaleTimeString()}</strong></p>
        <table>
          <thead>
            <tr>
              ${columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${results.map(row => `
              <tr>
                ${columns.map(col => `<td>${String(row[col] ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p><br /></p>
      </div>
    `;

    setPendingInsightContent(htmlTable);
    setIsInsightsOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle insights with Cmd+I or Ctrl+I
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsInsightsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!authReady) return null;

  if (!user) {
    return <Auth onSuccess={setUser} />;
  }

  return (
    <div className={`grid grid-cols-1 ${activeMainTab === 'typing' ? 'lg:grid-cols-[60px_1fr]' : 'lg:grid-cols-[60px_240px_1fr_280px]'} grid-rows-[48px_1fr] h-screen w-screen bg-[#f5f3ff] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-all selection:bg-primary/30 ${isDarkMode ? 'dark' : ''}`}>
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[200px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>

      {/* Header */}
      <header className="col-span-1 lg:col-span-full bg-transparent border-b border-primary/10 dark:border-slate-800/60 flex items-center justify-between px-4 z-[100] shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg active:scale-95 transition-colors"
          >
            <LayoutGrid size={20} />
          </button>
          <div className="w-7 h-7 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-center shadow-md">
            <svg 
              viewBox="0 0 25.6 25.6" 
              className="w-[18px] h-[18px]"
              fill="none" 
              stroke="#fff"
            >
              <path d="M18.983 18.636c.163-1.357.114-1.555 1.124-1.336l.257.023c.777.035 1.793-.125 2.4-.402 1.285-.596 2.047-1.592.78-1.33-2.89.596-3.1-.383-3.1-.383 3.053-4.53 4.33-10.28 3.227-11.687-3.004-3.84-8.205-2.024-8.292-1.976l-.028.005c-.57-.12-1.2-.19-1.93-.2-1.308-.02-2.3.343-3.054.914 0 0-9.277-3.822-8.846 4.807.092 1.836 2.63 13.9 5.66 10.25C8.29 15.987 9.36 14.86 9.36 14.86c.53.353 1.167.533 1.834.468l.052-.044a2.01 2.01 0 0 0 .021.518c-.78.872-.55 1.025-2.11 1.346-1.578.325-.65.904-.046 1.056.734.184 2.432.444 3.58-1.162l-.046.183c.306.245.285 1.76.33 2.842s.116 2.093.337 2.688.48 2.13 2.53 1.7c1.713-.367 3.023-.896 3.143-5.81" fill="#0c1b2f" stroke="#0c1b2f" strokeLinecap="butt" strokeWidth="2.149" />
              <path d="M23.535 15.6c-2.89.596-3.1-.383-3.1-.383 3.053-4.53 4.33-10.28 3.228-11.687-3.004-3.84-8.205-2.023-8.292-1.976l-.028.005a10.31 10.31 0 0 0-1.929-.201c-1.308-.02-2.3.343-3.054.914 0 0-9.278-3.822-8.846 4.807.092 1.836 2.63 13.9 5.66 10.25C8.29 15.987 9.36 14.86 9.36 14.86c.53.353 1.167.533 1.834.468l.052-.044a2.02 2.02 0 0 0 .021.518c-.78.872-.55 1.025-2.11 1.346-1.578.325-.65.904-.046 1.056.734.184 2.432.444 3.58-1.162l-.046.183c.306.245.52 1.593.484 2.815s-.06 2.06.18 2.716.48 2.13 2.53 1.7c1.713-.367 2.6-1.32 2.725-2.906.088-1.128.286-.962.3-1.97l.16-.478c.183-1.53.03-2.023 1.085-1.793l.257.023c.777.035 1.794-.125 2.39-.402 1.285-.596 2.047-1.592.78-1.33z" fill="#336791" stroke="none"/>
              <g strokeWidth=".716">
                <g strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.814 16.467c-.08 2.846.02 5.712.298 6.4s.875 2.05 2.926 1.612c1.713-.367 2.337-1.078 2.607-2.647l.633-5.017M10.356 2.2S1.072-1.596 1.504 7.033c.092 1.836 2.63 13.9 5.66 10.25C8.27 15.95 9.27 14.907 9.27 14.907m6.1-13.4c-.32.1 5.164-2.005 8.282 1.978 1.1 1.407-.175 7.157-3.228 11.687" />
                  <path d="M20.425 15.17s.2.98 3.1.382c1.267-.262.504.734-.78 1.33-1.054.49-3.418.615-3.457-.06-.1-1.745 1.244-1.215 1.147-1.652-.088-.394-.69-.78-1.086-1.744-.347-.84-4.76-7.29 1.224-6.333.22-.045-1.56-5.7-7.16-5.782S7.99 8.196 7.99 8.196" strokeLinejoin="bevel"/>
                </g>
                <g strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.247 15.768c-.78.872-.55 1.025-2.11 1.346-1.578.325-.65.904-.046 1.056.734.184 2.432.444 3.58-1.163.35-.49-.002-1.27-.482-1.468-.232-.096-.542-.216-.94.23z"/>
                  <path d="M11.196 15.753c-.08-.513.168-1.122.433-1.836.398-1.07 1.316-2.14.582-5.537-.547-2.53-4.22-.527-4.22-.184s.166 1.74-.06 3.365c-.297 2.122 1.35 3.916 3.246 3.733" />
                </g>
              </g>
              <g fill="#fff">
                <path d="M10.322 8.145c-.017.117.215.43.516.472s.558-.202.575-.32-.215-.246-.516-.288-.56.02-.575.136z" strokeWidth=".239" />
                <path d="M19.486 7.906c.016.117-.215.43-.516.472s-.56-.202-.575-.32.215-.246.516-.288.56.02.575.136z" strokeWidth=".119" />
              </g>
              <path d="M20.562 7.095c.05.92-.198 1.545-.23 2.524-.046 1.422.678 3.05-.413 4.68" strokeLinecap="round" strokeLinejoin="round" strokeWidth=".716" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase">
              Data Studio
            </h1>
            <span className="text-xs text-slate-300 dark:text-slate-700 mx-1">|</span>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
              {activeProject || 'Workspace'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsInsightsOpen(!isInsightsOpen)}
              className={`p-2 rounded-md transition-all ${isInsightsOpen ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Notes (Cmd + I)"
            >
              <MessageSquareQuote size={18} />
            </button>
            <button 
              onClick={() => setActiveMainTab(prev => prev === 'explorer' ? 'typing' : 'explorer')}
              className={`p-2 rounded-md transition-all ${activeMainTab === 'typing' ? 'text-primary bg-primary/10 animate-pulse' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Typing Speed Trainer"
            >
              <Keyboard size={18} />
            </button>
            <button 
              onClick={() => setIsImportOpen(true)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition-all"
              title="Import"
            >
              <Download size={18} />
            </button>
            <button 
              onClick={() => {
                const newMode = !isDarkMode;
                setIsDarkMode(newMode);
                localStorage.setItem('theme', newMode ? 'dark' : 'light');
              }}
              className="p-2 text-slate-400 hover:text-primary rounded-md transition-all"
              title="Theme Toggle"
            >
              {isDarkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} />}
            </button>
          </div>
          
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 hidden sm:inline">{user?.username}</span>
            <div className="w-8 h-8 rounded bg-primary/10 dark:bg-primary/20 border border-primary/20 flex items-center justify-center text-xs font-black text-primary shadow-sm">
               {user?.username?.[0]?.toUpperCase()}
            </div>
          </div>
          
          <button 
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* Global Navigation Bar */}
      <nav className="hidden lg:flex flex-col items-center py-6 bg-transparent border-r border-primary/10 dark:border-slate-800/60 z-20 gap-8 shadow-sm">
        <button 
          onClick={() => setActiveMainTab('explorer')}
          className={`p-3 rounded-xl shadow-sm hover:scale-105 transition-all ${activeMainTab === 'explorer' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`} 
          title="Explorer"
        >
          <Database size={24} />
        </button>
        <button 
          onClick={() => setActiveMainTab('typing')}
          className={`p-3 rounded-xl shadow-sm hover:scale-105 transition-all ${activeMainTab === 'typing' ? 'bg-primary/10 text-primary animate-pulse' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`} 
          title="Practice Typing Speed"
        >
          <Keyboard size={24} />
        </button>
        <button 
          className={`p-3 rounded-xl transition-all ${isInsightsOpen ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`} 
          title="Insights (Cmd + I)"
          onClick={() => setIsInsightsOpen(!isInsightsOpen)}
        >
          <Sparkles size={24} />
        </button>
        <div className="mt-auto flex flex-col items-center gap-6">
          <button className="p-3 text-slate-400 hover:text-rose-500 transition-colors" title="Logout" onClick={() => authApi.logout()}>
            <LogOut size={22} />
          </button>
        </div>
      </nav>


      {/* Mobile Sidebars */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[110] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="absolute left-0 top-0 bottom-0 w-[280px] animate-in slide-in-from-left duration-300">
            <Sidebar 
              tables={tables}
              folders={folders}
              projects={projects}
              activeProject={activeProject}
              onProjectChange={setActiveProject}
              onProjectCreate={handleCreateProject}
              onProjectDelete={handleDeleteProject}
              schemas={schemas}
              savedQueries={savedQueries} 
              onTableClick={(table) => {
                handleTableClick(table);
                setView('grid');
                setIsSidebarOpen(false);
              }}
              onColumnClick={handleColumnClick}
              onQueryClick={(query) => {
                setSql(query);
                setView('grid');
                setIsSidebarOpen(false);
              }}
              onExportTable={handleExportTable}
              onDeleteTable={handleDeleteTable}
              onMoveTable={handleMoveTable}
              onDeleteQuery={handleDeleteQuery}
              onLogout={() => authApi.logout()}
              user={user}
            />
          </div>
        </div>
      )}

      {isRightSidebarOpen && (
        <div className="fixed inset-0 z-[110] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsRightSidebarOpen(false)}></div>
          <div className="absolute right-0 top-0 bottom-0 w-[300px] animate-in slide-in-from-right duration-300">
             <aside className="h-full bg-[#f5f3ff] dark:bg-slate-900 border-l border-primary/10 dark:border-slate-800 p-8 flex flex-col gap-10 overflow-hidden relative">
                <section className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">History</h3>
                    <button onClick={() => setIsRightSidebarOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={16} /></button>
                  </div>
                  <div className="space-y-4">
                    {history.map((h) => (
                      <div 
                        key={h.id}
                        onClick={() => { setSql(h.query); setIsRightSidebarOpen(false); }}
                        className="p-4 rounded-2xl bg-[#ede9fe] dark:bg-slate-800/40 border border-primary/20 dark:border-slate-700 group cursor-pointer hover:border-primary/50 transition-all shadow-sm relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${h.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            <span className={`text-[10px] font-bold ${h.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {h.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => handleCopyQuery(e, h.query, h.id)}
                              className={`p-1 rounded-md transition-all ${copyingHistoryId === h.id ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100'}`}
                            >
                              {copyingHistoryId === h.id ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                              {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors italic">{h.query}</div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="py-10 text-center opacity-30 text-[10px] uppercase font-bold tracking-widest text-slate-400">No History</div>
                    )}
                  </div>
                </section>

                <section className="flex-1 flex flex-col gap-6 overflow-hidden">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Favorites</h3>
                  <div className="space-y-2 overflow-y-auto pr-2 scrollbar-thin">
                    {savedQueries.map(sq => (
                      <div 
                        key={sq.id} 
                        onClick={() => { setSql(sq.query); setIsRightSidebarOpen(false); }}
                        className="group flex flex-col gap-2 p-4 rounded-xl hover:bg-primary/5 dark:hover:bg-slate-800/50 border border-transparent hover:border-primary/20 dark:hover:border-slate-700 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
                            <LayoutGrid size={12} strokeWidth={3} />
                          </div>
                          <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors truncate">{sq.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
             </aside>
          </div>
        </div>
      )}

      {activeMainTab === 'explorer' && (
        <div className="hidden lg:block overflow-hidden relative border-r border-primary/10 dark:border-slate-800">
          <Sidebar 
            tables={tables}
            folders={folders}
            projects={projects}
            activeProject={activeProject}
            onProjectChange={setActiveProject}
            onProjectCreate={handleCreateProject}
            onProjectDelete={handleDeleteProject}
            schemas={schemas}
            savedQueries={savedQueries} 
            onTableClick={(table) => {
              handleTableClick(table);
              setView('grid');
            }}
            onColumnClick={handleColumnClick}
            onQueryClick={(query) => {
              setSql(query);
              setView('grid');
            }}
            onExportTable={handleExportTable}
            onDeleteTable={handleDeleteTable}
            onMoveTable={handleMoveTable}
            onDeleteQuery={handleDeleteQuery}
            onLogout={() => authApi.logout()}
            user={user}
          />
        </div>
      )}

      {activeMainTab === 'typing' ? (
        <div className="col-span-1 overflow-hidden bg-transparent">
          <TypingTrainer onBackToExplorer={() => setActiveMainTab('explorer')} />
        </div>
      ) : (
        <main className="grid grid-rows-[45%_1fr_26px] overflow-hidden bg-transparent p-2 gap-2">
        <div className="flex flex-col bg-white dark:bg-slate-900/50 border border-primary/10 dark:border-slate-800 shadow-sm overflow-hidden min-h-[150px]">
          <SQLEditor 
            sql={sql} 
            setSql={setSql} 
            onRun={handleRunQuery}
            onSave={handleSaveQuery}
            isLoading={isLoading} 
            isDarkMode={isDarkMode}
            tables={tables}
            schemas={schemas}
          />
        </div>

        <div className="flex flex-col overflow-hidden bg-white dark:bg-slate-900/50 border border-primary/10 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 dark:border-slate-800 bg-[#ede9fe]/50 dark:bg-slate-800/20">
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Results Explorer</span>
             </div>
             <div className="flex items-center gap-1.5 bg-primary/5 dark:bg-slate-950/40 p-1 rounded-xl border border-primary/10 dark:border-slate-800">
              <button 
                onClick={() => setView('grid')} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${view === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                title="Table View"
              >
                <Table2 size={14} />
                <span className="text-[10px] font-bold uppercase hidden sm:inline">Grid</span>
              </button>
              <button 
                onClick={() => setView('viz')} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${view === 'viz' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                title="Visualization"
              >
                <BarChart3 size={14} />
                <span className="text-[10px] font-bold uppercase hidden sm:inline">Visual</span>
              </button>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
              <button 
                onClick={handleExport} 
                className="p-2 text-slate-500 hover:text-primary transition-all rounded-lg"
                title="Download CSV"
              >
                <Download size={14} />
              </button>
              <button 
                onClick={handleSendToInsights} 
                className="p-2 text-slate-500 hover:text-primary transition-all rounded-lg"
                title="Send to Insights"
              >
                <MessageSquareQuote size={14} />
              </button>
              <button 
                onClick={handleCopyResults} 
                className={`p-2 transition-all rounded-lg ${copying ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 hover:text-primary'}`}
                title="Copy Results"
              >
                {copying ? <Check size={14} /> : <Copy size={14} />}
              </button>
           </div>
          </div>
          
          <div className="flex-1 overflow-auto bg-white dark:bg-slate-950/50">
            {view === 'grid' ? (
              <DataGrid 
                data={results} 
                fields={fields} 
                error={error}
                executionTime={executionTime}
                onExport={handleExport}
                onCopy={handleCopyResults}
              />
            ) : (
              <Visualizer data={results} />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em] bg-transparent border-t border-primary/10 dark:border-slate-800">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : (results.length > 0 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800')}`}></div>
              <span>{error ? 'Execution Error' : (results.length > 0 ? 'Success' : 'Ready')}</span>
            </div>
            <span className="opacity-20">|</span>
            <div className="flex items-center gap-4">
               <span>Rows: <span className="text-slate-900 dark:text-white">{results.length}</span></span>
               {executionTime !== undefined && <span>Time: <span className="text-primary">{executionTime}ms</span></span>}
            </div>
          </div>
          <div className="font-mono flex items-center gap-4">
             <span className="text-primary/60">UTF-8 / SQL</span>
             <span className="opacity-20">|</span>
             <span className="text-slate-300 dark:text-slate-700">v1.0.4</span>
          </div>
        </div>
      </main>
      )}


      {activeMainTab === 'explorer' && (
        <aside className="hidden lg:flex bg-transparent border-l border-primary/10 dark:border-slate-800 p-8 flex-col gap-10 overflow-hidden relative">
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">History</h3>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">{history.length} Items</span>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin">
            {history.map((h) => (
              <div 
                key={h.id}
                onClick={() => setSql(h.query)}
                className="p-4 rounded-2xl bg-[#ede9fe] dark:bg-slate-800/40 border border-primary/20 dark:border-slate-700 group cursor-pointer hover:border-primary/50 transition-all shadow-sm relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${h.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    <span className={`text-[10px] font-bold ${h.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {h.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleCopyQuery(e, h.query, h.id)}
                      className={`p-1 rounded-md transition-all ${copyingHistoryId === h.id ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100'}`}
                    >
                      {copyingHistoryId === h.id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors italic">{h.query}</div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-center gap-4 opacity-20">
                <div className="w-12 h-12 rounded-full bg-[#ede9fe] dark:bg-slate-800 flex items-center justify-center">
                  <Play size={20} className="text-slate-400 ml-1" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ready</span>
              </div>
            )}
          </div>
        </section>

        <section className="flex-1 flex flex-col gap-6 overflow-hidden">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Favorites</h3>
          <div className="space-y-2 overflow-y-auto pr-2 scrollbar-thin">
            {savedQueries.map(sq => (
              <div 
                key={sq.id} 
                onClick={() => setSql(sq.query)}
                className="group flex flex-col gap-2 p-4 rounded-xl hover:bg-primary/5 dark:hover:bg-slate-800/50 border border-transparent hover:border-primary/20 dark:hover:border-slate-700 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <LayoutGrid size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors truncate">{sq.name}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate ml-9 opacity-60">-- {sq.query}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-auto p-4 border-t border-primary/10 dark:border-slate-800 space-y-4">
          <div className="p-3.5 rounded-xl bg-[#ede9fe] dark:bg-slate-900 border border-primary/20 dark:border-slate-800 group shadow-sm text-primary">
            <h4 className="text-[8px] font-bold uppercase tracking-widest mb-2 opacity-50">System Logs</h4>
            <div className="space-y-1.5 text-[9px] font-bold text-slate-400">
              <div className="flex justify-between items-center">
                <span>DB Status</span>
                <span className="text-emerald-500">OK</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Latency</span>
                <span className="text-primary">12ms</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => authApi.logout()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm"
          >
            <LogOut size={12} /> Logout
          </button>
        </div>
      </aside>
      )}

      {isImportOpen && (
        <ImportModal 
          onClose={() => setIsImportOpen(false)} 
          onSuccess={fetchData} 
          projects={projects}
        />
      )}

      {isProjectModalOpen && (
        <ProjectModal
          onClose={() => setIsProjectModalOpen(false)}
          onSuccess={() => {
            setIsProjectModalOpen(false);
            fetchData();
          }}
        />
      )}

      {movingTable && (
        <MoveTableModal
          tableName={movingTable.name}
          currentFolder={movingTable.currentFolder}
          projects={projects}
          onClose={() => setMovingTable(null)}
          onSuccess={() => {
            setMovingTable(null);
            fetchData();
          }}
        />
      )}

      <InsightsPanel 
        isOpen={isInsightsOpen} 
        onClose={() => setIsInsightsOpen(false)} 
        activeProject={activeProject}
        insertContent={pendingInsightContent}
        onContentInserted={() => setPendingInsightContent(null)}
      />
    </div>
  );
}
