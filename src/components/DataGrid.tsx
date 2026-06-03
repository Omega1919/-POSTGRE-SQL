import { Download, Table as TableIcon, MessageSquareQuote, Copy, X, AlertCircle, Check } from 'lucide-react';

interface DataGridProps {
  data: any[];
  fields: any[];
  error?: string | null;
  executionTime?: number;
  onExport?: () => void;
  onCopy?: () => void;
}

export default function DataGrid({ data, fields, error, executionTime, onExport, onCopy }: DataGridProps) {
    if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 bg-transparent overflow-auto">
        <div className="bg-white dark:bg-slate-900 border border-rose-500/30 rounded-2xl p-8 max-w-xl w-full shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-0.5">Query Error</h3>
              <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500 dark:text-rose-400 opacity-60">The query could not be finished</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-[#f5f3ff] dark:bg-slate-950 rounded-xl p-4 font-mono text-[11px] text-rose-600 dark:text-rose-300 break-words border border-rose-500/10 select-text leading-relaxed shadow-inner">
              {error}
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 bg-transparent italic p-12">
        <div className="w-16 h-16 rounded-2xl bg-[#f5f3ff]/50 dark:bg-slate-900/50 border border-primary/20 dark:border-slate-800 mb-6 flex items-center justify-center shadow-sm">
           <TableIcon size={32} strokeWidth={1} className="text-primary/40" />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.3em] mb-2 leading-none text-slate-600 dark:text-slate-400">Empty Result Set</p>
        <p className="text-[10px] opacity-60 uppercase tracking-widest font-bold font-mono">Run a query to retrieve data</p>
      </div>
    );
  }

  // Handle case where data is NOT an array (e.g., response from INSERT/UPDATE/DELETE)
  if (!Array.isArray(data)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 bg-transparent">
        <div className="bg-white/50 dark:bg-slate-900/50 p-8 rounded-2xl border border-emerald-500/20 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 mx-auto mb-4 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Check className="w-6 h-6 text-white" strokeWidth={3} />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-4">Success</p>
          <div className="text-[10px] font-mono space-y-2 bg-[#f5f3ff] dark:bg-slate-950 p-4 rounded-xl border border-primary/20 dark:border-slate-800 shadow-inner">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center border-b border-primary/10 dark:border-slate-800 last:border-0 pb-1.5 pt-0.5">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{key}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const columns = (fields || []).map(f => f.name || (data[0] ? Object.keys(data[0])[0] : ''));

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden relative">
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-left border-collapse min-w-full font-sans text-xs">
          <thead className="sticky top-0 bg-[#f5f3ff]/95 dark:bg-slate-950/95 backdrop-blur-sm z-10 border-b border-primary/10 dark:border-slate-800 shadow-sm">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="px-4 py-3 text-slate-700 dark:text-slate-300 font-black whitespace-nowrap uppercase tracking-widest text-[10px] border-r border-primary/10 dark:border-slate-800 last:border-r-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
                    {col}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5 dark:divide-slate-800/40">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-primary/[0.02] dark:hover:bg-primary/[0.05] transition-colors group">
                {columns.map((j, idx) => (
                  <td key={idx} className="px-4 py-3 text-slate-700 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white whitespace-nowrap border-r border-primary/5 dark:border-slate-800/30 last:border-r-0 max-w-[300px] text-ellipsis overflow-hidden font-mono text-[11px]">
                    {row[j] === null ? (
                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-30 italic">NULL</span>
                    ) : (
                      <span className="tracking-tight">{String(row[j])}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

