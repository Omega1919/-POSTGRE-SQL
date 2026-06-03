import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { 
  Heading1, Heading2, Heading3, Heading4, 
  Bold, Italic, Code, List, ListOrdered, Save, X, Trash2, 
  ChevronRight,
  MessageSquareQuote,
  Table as TableIcon,
  Plus,
  Minus,
  Columns2,
  Rows2,
  Loader2
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { db } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

interface InsightsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: string | null;
  insertContent?: string | null;
  onContentInserted?: () => void;
}

// Simple in-memory cache for fast switching
export const insightsCache: Record<string, string> = {};

export default function InsightsPanel({ isOpen, onClose, activeProject, insertContent, onContentInserted }: InsightsPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const isInitializingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: insightsCache[activeProject || 'global'] || '',
    onUpdate: () => {
      if (!isInitializingRef.current) {
        const currentContent = editor?.getHTML() || '';
        insightsCache[activeProject || 'global'] = currentContent;
        setIsDirty(true);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-base dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-10 text-[17px] leading-[1.8] font-sans [&_h1]:text-3xl [&_h1]:font-black [&_h1]:uppercase [&_h1]:tracking-tight [&_h1]:border-b-4 [&_h1]:border-primary/20 [&_h1]:pb-6 [&_h1]:mb-10 [&_h1]:text-slate-800 dark:[&_h1]:text-white [&_p]:text-slate-600 dark:[&_p]:text-slate-400 [&_p]:mb-8 [&_table]:border-collapse [&_table]:w-full [&_table]:my-10 [&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-white/10 [&_th]:p-5 [&_th]:bg-slate-100 dark:[&_th]:bg-white/5 [&_th]:font-black [&_th]:uppercase [&_th]:text-[11px] [&_th]:tracking-[0.2em] [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-white/10 [&_td]:p-5 [&_td]:font-mono [&_td]:text-[14px] [&_.selectedCell]:bg-primary/10 [&_.selectedCell]:ring-2 [&_.selectedCell]:ring-primary/20 [&_table_td]:relative [&_table_th]:relative',
      },
    },
  });

  useEffect(() => {
    if (isOpen && editor) {
      const cacheKey = activeProject || 'global';
      const hasCachedContent = !!insightsCache[cacheKey];
      
      // If we don't have cached content, show the loader. 
      // If we DO have cached content, just fetch in the background silently.
      if (!hasCachedContent) {
        setIsLoading(true);
      }
      
      isInitializingRef.current = true;
      db.getInsights(activeProject || undefined)
        .then(res => {
          const remoteContent = res.content || `<h1>${activeProject || 'Global'} Insights</h1><p>Record your observations for ${activeProject ? activeProject : 'this workspace'} here...</p>`;
          
          // Only update editor if it's not and we haven't typed anything yet, 
          // or if we didn't have cache before
          const currentText = editor.getText();
          const isActuallyEmpty = currentText.trim() === '' || currentText.includes('Record your observations');
          
          if (!isDirty || isActuallyEmpty) {
            editor.commands.setContent(remoteContent);
            insightsCache[cacheKey] = remoteContent;
          }
          
          // Small delay to ensure onUpdate triggered by setContent is processed
          setTimeout(() => {
            isInitializingRef.current = false;
            setIsDirty(false);
            setIsLoading(false);
          }, 50);
          
          // Scroll to bottom after content is loaded (only if it was empty or first load)
          if (!hasCachedContent) {
            setTimeout(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({
                  top: scrollContainerRef.current.scrollHeight,
                  behavior: 'smooth'
                });
              }
            }, 300);
          }
        })
        .catch(err => {
          console.error('Failed to fetch insight:', err);
          setIsLoading(false);
          isInitializingRef.current = false;
        });
    }
  }, [isOpen, editor, activeProject]);

  // Auto-save every 30 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && editor && isDirty && !isLoading) {
      interval = setInterval(() => {
        handleSave();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, editor, isDirty, isLoading]);

  const handleSave = async () => {
    if (!editor || !isDirty || isLoading || isSaving) return;
    
    // Check if we're online
    if (!window.navigator.onLine) {
      console.warn('Auto-save skipped: Device is offline');
      return;
    }

    const content = editor.getHTML();
    
    // Safety: Never save "Loading..." or empty content if it looks like it was wiped
    if (content.includes('Loading...') && isLoading) return;

    setIsSaving(true);
    try {
      await db.saveInsight(content, activeProject || undefined);
      setLastSaved(new Date());
      setIsDirty(false);
    } catch (err: any) {
      // If it's a "Failed to fetch", it's likely a network/server issue
      if (err.message === 'Failed to fetch') {
        console.warn('Auto-save temporarily failed due to network issues. Will retry in 30 seconds.');
      } else {
        console.error('Auto-save failed:', err);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Background the save if dirty - no await
    if (isDirty && !isLoading) {
      handleSave();
    }
    onClose();
  };

  useEffect(() => {
    if (insertContent && editor) {
      // Focus and insert at the end of the document
      editor.chain().focus().insertContent(insertContent).run();
      if (onContentInserted) onContentInserted();
      
      // Auto-scroll to bottom
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 500);
    }
  }, [insertContent, editor, onContentInserted]);

  const toolbarButtonClass = "p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-primary transition-all duration-300 active:scale-90 shadow-sm hover:shadow-md";
  const activeButtonClass = "bg-primary/20 dark:bg-primary/30 text-primary ring-1 ring-primary/30";

  if (!editor) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed right-4 top-4 bottom-4 w-[500px] bg-[#f5f3ff]/90 dark:bg-slate-900/80 backdrop-blur-xl border border-primary/20 dark:border-slate-800 shadow-2xl z-[70] flex flex-col rounded-[2.5rem] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-primary/10 dark:border-slate-800 bg-transparent">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary shadow-inner">
                  <MessageSquareQuote size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Notes</h2>
                  <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {activeProject || 'General Insights'}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2 px-6 py-3 border-b border-primary/10 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1 p-1 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-primary/10 dark:border-slate-800">
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`${toolbarButtonClass} ${editor.isActive('heading', { level: 1 }) ? activeButtonClass : ''}`}
                    title="Large Text"
                  >
                    <Heading1 size={14} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`${toolbarButtonClass} ${editor.isActive('heading', { level: 2 }) ? activeButtonClass : ''}`}
                    title="Medium Text"
                  >
                    <Heading2 size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-1 p-1 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-primary/10 dark:border-slate-800">
                  <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`${toolbarButtonClass} ${editor.isActive('bold') ? activeButtonClass : ''}`}
                    title="Bold"
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`${toolbarButtonClass} ${editor.isActive('italic') ? activeButtonClass : ''}`}
                    title="Italic"
                  >
                    <Italic size={14} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    className={`${toolbarButtonClass} ${editor.isActive('code') ? activeButtonClass : ''}`}
                    title="Code"
                  >
                    <Code size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-1 p-1 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-primary/10 dark:border-slate-800">
                  <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`${toolbarButtonClass} ${editor.isActive('bulletList') ? activeButtonClass : ''}`}
                    title="List"
                  >
                    <List size={14} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                    className={`${toolbarButtonClass} ${editor.isActive('table') ? activeButtonClass : ''}`}
                    title="Add Table"
                  >
                    <TableIcon size={14} />
                  </button>
                </div>

                {editor.isActive('table') && (
                  <div className="flex items-center gap-1 p-1 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 animate-in fade-in slide-in-from-left-2 duration-300">
                    <button
                      onClick={() => editor.chain().focus().addColumnAfter().run()}
                      className={`${toolbarButtonClass} hover:text-amber-600`}
                      title="Add Column"
                    >
                      <Plus size={12} className="mr-0.5" />
                      <Columns2 size={12} />
                    </button>
                    <button
                      onClick={() => editor.chain().focus().addRowAfter().run()}
                      className={`${toolbarButtonClass} hover:text-amber-600`}
                      title="Add Row"
                    >
                      <Plus size={12} className="mr-0.5" />
                      <Rows2 size={12} />
                    </button>
                    <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-1" />
                    <button
                      onClick={() => editor.chain().focus().deleteColumn().run()}
                      className={`${toolbarButtonClass} text-rose-400 hover:text-rose-600`}
                      title="Delete Column"
                    >
                      <Minus size={12} className="mr-0.5" />
                      <Columns2 size={12} />
                    </button>
                    <button
                      onClick={() => editor.chain().focus().deleteRow().run()}
                      className={`${toolbarButtonClass} text-rose-400 hover:text-rose-600`}
                      title="Delete Row"
                    >
                      <Minus size={12} className="mr-0.5" />
                      <Rows2 size={12} />
                    </button>
                    <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-1" />
                    <button
                      onClick={() => editor.chain().focus().deleteTable().run()}
                      className={`${toolbarButtonClass} text-rose-500 hover:bg-rose-500/10`}
                      title="Delete Entire Table"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                
                <div className="flex-1" />
                
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary-hover disabled:opacity-30 transition-all shadow-lg shadow-primary/20"
                >
                  {isSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save size={14} strokeWidth={3} />
                  )}
                  Save
                </button>
              </div>

              {/* Editor Area */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto bg-transparent p-6 scroll-smooth relative"
              >
                {isLoading && (
                  <div className="absolute inset-0 z-10 bg-[#f5f3ff]/60 dark:bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center">
                      <Loader2 className="text-primary animate-spin" size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary animate-pulse">Syncing Insights...</span>
                  </div>
                )}
                <div className={`bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl min-h-full shadow-sm transition-all ${isLoading ? 'opacity-20 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  <EditorContent editor={editor} />
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t border-primary/10 dark:border-slate-800 bg-transparent flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {isDirty ? 'Unsaved Changes' : 'All synced'}
                    </span>
                  </div>
                  {lastSaved ? (
                    <span className="text-[9px] font-bold text-slate-400 italic">Last auto-save: {lastSaved.toLocaleTimeString()}</span>
                  ) : (
                    <span className="text-[9px] font-bold text-slate-500/50 uppercase tracking-tighter">Namespace: {activeProject || 'Global'}</span>
                  )}
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={() => editor.commands.clearContent()}
                    className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-500/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    <Trash2 size={14} /> Clear
                  </button>
                  <button 
                    onClick={handleClose}
                    className="px-4 py-2 text-slate-500 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
