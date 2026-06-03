import React, { useState } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Upload, X, FileText, File as FileIcon, Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import { db } from '../lib/api';
import { motion } from 'motion/react';

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
  projects: any[];
}

export default function ImportModal({ onClose, onSuccess, projects }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const existingFolders = Array.from(new Set((projects || []).map(p => p && p.name)));

  const accept: Accept = {
    'text/csv': ['.csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => setFile(acceptedFiles[0]),
    accept,
    multiple: false,
  } as any);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const res = await db.importFile(file, tableName, folderName, (progress) => {
        setUploadProgress(progress);
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#ede9fe]/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="bg-[#f5f3ff] dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-primary/20 dark:border-slate-800 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-between px-8 py-5 border-b border-primary/10 dark:border-slate-800 bg-[#ede9fe]/50 dark:bg-slate-900/50">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Import Data</h2>
          <button onClick={onClose} className="p-1 px-2 text-slate-400 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!file ? (
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-[1.5rem] p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                isDragActive ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-slate-200 dark:border-slate-800 hover:border-primary hover:bg-primary/5'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-primary/10 dark:border-slate-700 flex items-center justify-center text-primary mb-4 shadow-sm">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-widest">Select File</p>
              <p className="text-[#64748b] dark:text-slate-400 mt-2 font-mono uppercase text-[10px]">CSV, XLSX (Limit: 50MB)</p>
            </div>
          ) : (
            <div className="space-y-6 text-slate-800 dark:text-slate-200">
              <div className="flex items-center gap-4 p-4 bg-[#ede9fe]/30 dark:bg-slate-950 rounded-2xl border border-primary/10 dark:border-slate-800 group">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-primary/10 dark:border-slate-800 flex items-center justify-center text-primary shadow-sm">
                  {file.name.endsWith('.csv') ? <FileText className="w-6 h-6" /> : <FileIcon className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{file.name}</p>
                  <p className="text-[10px] font-mono opacity-60">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button 
                  onClick={() => setFile(null)} 
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30"
                  disabled={isUploading}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2 ml-1">
                    Table Name
                  </label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="example_table"
                    className="w-full px-5 py-4 bg-white dark:bg-slate-950 border border-primary/10 dark:border-slate-800 rounded-xl text-sm font-bold focus:border-primary outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isUploading}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2 ml-1">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={folderName}
                    list="folders-list"
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="My Project"
                    className="w-full px-5 py-4 bg-white dark:bg-slate-950 border border-primary/10 dark:border-slate-800 rounded-xl text-sm font-bold focus:border-primary outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isUploading}
                  />
                  <datalist id="folders-list">
                    {existingFolders.map(f => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-900/10 text-rose-500 text-xs font-bold border border-rose-100 dark:border-rose-900/20 rounded-xl">
              Error: {error}
            </div>
          )}

          {success ? (
            <div className="flex flex-col items-center justify-center gap-3 text-emerald-500 font-bold py-4 text-xs uppercase tracking-widest animate-bounce">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={24} />
              </div>
              Success
            </div>
          ) : isUploading ? (
            <div className="space-y-4 pt-2">
              <div className="p-5 bg-white dark:bg-slate-950 rounded-2xl border border-primary/10 dark:border-slate-800 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-350">
                  <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-[10px]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    {uploadProgress < 100 ? 'Uploading file...' : 'Processing tables...'}
                  </span>
                  <span className="font-mono text-xs text-primary">{uploadProgress}%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden p-[2px]">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ type: "spring", stiffness: 80 }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  {uploadProgress < 100 ? (
                    <span>{((file.size / 1024) * (uploadProgress / 100)).toFixed(1)} KB uploaded</span>
                  ) : (
                    <span className="animate-pulse text-primary font-semibold">Creating database tables...</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="flex-[2] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white bg-primary hover:bg-primary-hover rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-30 flex items-center justify-center gap-3 active:scale-95"
              >
                Upload Data
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

