import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Save, Sparkles, Play, Loader2, Database, Code, Copy, Check } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface SQLEditorProps {
  sql: string;
  setSql: (sql: string) => void;
  onRun: () => void;
  onSave: () => void;
  isLoading: boolean;
  isDarkMode: boolean;
  tables: string[];
  schemas: Record<string, any[]>;
}

export default function SQLEditor({ sql, setSql, onRun, onSave, isLoading, isDarkMode, tables, schemas }: SQLEditorProps) {
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const lastInternalValue = useRef<string>(sql);
  const onRunRef = useRef(onRun);
  const completionProviderRef = useRef<any>(null);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  const tablesRef = useRef(tables);
  const schemasRef = useRef(schemas);

  useEffect(() => {
    tablesRef.current = tables;
    schemasRef.current = schemas;
  }, [tables, schemas]);

  const handleAiSuggest = async () => {
    const prompt = window.prompt("Describe what you want to query (e.g., 'Show top 5 customers by revenue'):");
    if (!prompt) return;

    setIsAiGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          You are a SQL expert. Generate a MySQL query based on this request: "${prompt}".
          Available tables: ${tables.join(', ')}.
          Table Columns: ${Object.entries(schemas).map(([t, cols]) => `${t}(${(cols || []).map(c => c.Field).join(', ')})`).join('; ')}
          Important Guidelines:
          - Use EXACT column names provided above.
          - MANDATORY: Wrap any table or column name that has spaces or special characters in backticks (e.g., \`Customer ID\`).
          - NEVER use single quotes ('') or double quotes ("") for table or column names; these will cause syntax errors.
          - Use single quotes ('') ONLY for string values (e.g., WHERE Name = 'John').
          Return ONLY the raw SQL code, no markdown formatting, no descriptions.
        `
      });
      
      const text = response.text?.replace(/```sql|```/g, '').trim();
      if (text) setSql(text);
    } catch (err: any) {
      alert('AI Suggestion failed: ' + err.message);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Custom theme to match our colorful aesthetic
    monaco.editor.defineTheme('colorful-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '8b5cf6', fontStyle: 'bold' },
        { token: 'string', foreground: 'd946ef' },
        { token: 'number', foreground: 'f43f5e' },
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#020617',
        'editor.foreground': '#f8fafc',
        'editorLineNumber.foreground': '#1e293b',
        'editorLineNumber.activeForeground': '#8b5cf6',
        'editorCursor.foreground': '#8b5cf6',
        'editorSelection.background': '#8b5cf622',
        'editor.lineHighlightBackground': '#1e293b55',
      }
    });

    monaco.editor.defineTheme('colorful-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '#8b5cf6', fontStyle: 'bold' },
        { token: 'string', foreground: '#d946ef' },
        { token: 'number', foreground: '#f43f5e' },
        { token: 'comment', foreground: '#94a3b8', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#f5f3ff',
        'editor.foreground': '#0f172a',
        'editorLineNumber.foreground': '#c4b5fd',
        'editorLineNumber.activeForeground': '#8b5cf6',
        'editorCursor.foreground': '#8b5cf6',
        'editorSelection.background': '#8b5cf622',
        'editor.lineHighlightBackground': '#ede9fe',
      }
    });

    monaco.editor.setTheme(isDarkMode ? 'colorful-dark' : 'colorful-light');

    // Command to run query (Cmd+Enter or Ctrl+Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunRef.current();
    });

    const completionProvider = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Get unique column names across all tables using refs for latest data
        const allColumns = new Set<string>();
        Object.values(schemasRef.current).forEach(cols => {
          (cols || []).forEach(c => allColumns.add(c.Field));
        });

        const wrapIfNeeded = (name: string) => {
          if (/[A-Z]/.test(name) || /[^a-z0-9_]/.test(name)) return `"${name}"`;
          return name;
        };

        const sqlKeywords = [
          'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
          'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN',
          'ON', 'USING', 'UNION', 'UNION ALL', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
          'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL', 'AS', 'DISTINCT', 'ALL', 'ANY',
          'SOME', 'DESC', 'ASC', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
          'TRUNCATE', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CONSTRAINT', 'INDEX',
          'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
          'CAST', 'CONVERT', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK', 'DEFAULT',
          'AUTO_INCREMENT', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'WITH', 'RECURSIVE'
        ];

        const sqlFunctions = [
          // Aggregate
          'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT', 'VARIANCE', 'STDDEV',
          // String
          'CONCAT', 'SUBSTRING', 'LENGTH', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM',
          'REPLACE', 'LEFT', 'RIGHT', 'INSTR', 'FIND_IN_SET', 'FORMAT', 'CHAR_LENGTH',
          // Numeric
          'ROUND', 'FLOOR', 'CEIL', 'ABS', 'RAND', 'POWER', 'SQRT', 'MOD', 'EXP', 'LOG',
          // Date/Time
          'NOW', 'CURDATE', 'CURTIME', 'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY', 'HOUR',
          'MINUTE', 'SECOND', 'DATEDIFF', 'DATE_ADD', 'DATE_SUB', 'STR_TO_DATE', 'DATE_FORMAT',
          'UNIX_TIMESTAMP', 'FROM_UNIXTIME', 'LAST_DAY',
          // Window Functions
          'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'PERCENT_RANK', 'CUME_DIST', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE', 'NTILE', 'OVER', 'PARTITION BY',
          // Control Flow / Other
          'IF', 'IFNULL', 'COALESCE', 'NULLIF', 'LAST_INSERT_ID', 'DATABASE', 'USER', 'VERSION'
        ];

        const sqlDataTypes = [
          'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL', 'NUMERIC',
          'FLOAT', 'DOUBLE', 'BIT', 'CHAR', 'VARCHAR', 'BINARY', 'VARBINARY',
          'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB', 'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
          'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR', 'BOOLEAN', 'JSON', 'ENUM', 'SET'
        ];

        const suggestions = [
          // Keywords
          ...sqlKeywords.map(keyword => ({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range,
          })),
          // Functions
          ...sqlFunctions.map(func => ({
            label: func,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${func}($0)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Function',
            range,
          })),
          // Data Types
          ...sqlDataTypes.map(type => ({
            label: type,
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: type,
            detail: 'Data Type',
            range,
          })),
          // Tables
          ...tablesRef.current.map(table => ({
            label: table,
            kind: monaco.languages.CompletionItemKind.Struct,
            insertText: wrapIfNeeded(table),
            detail: 'Table',
            range,
          })),
          // Columns
          ...Array.from(allColumns).map(col => ({
            label: col,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: wrapIfNeeded(col),
            detail: 'Column',
            range,
          }))
        ];

        return { suggestions };
      },
    });

    completionProviderRef.current = completionProvider;
  };

  useEffect(() => {
    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
    };
  }, []);

  const memoizedOptions = useMemo(() => ({
    minimap: { enabled: false },
    fontSize: 16,
    fontFamily: '"JetBrains Mono", monospace',
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 8, bottom: 8 },
    wordWrap: 'on' as const,
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    contextmenu: false,
  }), []);

  // Handle editor value changes
  const handleEditorChange = useCallback((val: string | undefined) => {
    const newValue = val || '';
    // Only update if it's actually different from what we just recorded
    if (newValue !== lastInternalValue.current) {
      lastInternalValue.current = newValue;
      setSql(newValue);
    }
  }, [setSql]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setIsCopying(true);
      setTimeout(() => setIsCopying(false), 2000);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(isDarkMode ? 'colorful-dark' : 'colorful-light');
    }
  }, [isDarkMode]);

  // Synchronize external SQL changes (AI, table clicks, saved queries)
  useEffect(() => {
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue();
      
      // Normalize line endings for comparison
      const normalizedProp = sql.replace(/\r\n/g, '\n');
      const normalizedCurrent = currentValue.replace(/\r\n/g, '\n');
      const normalizedInternal = lastInternalValue.current.replace(/\r\n/g, '\n');

      // If the incoming sql is different from what we typed AND from current editor state
      if (normalizedProp !== normalizedInternal && normalizedProp !== normalizedCurrent) {
        // Only update if editor is not focused (prevents cursor jump while typing)
        // This is safe because external actions (clicking sidebars, AI buttons) 
        // cause the editor to lose focus first.
        if (!editorRef.current.hasTextFocus()) {
          editorRef.current.setValue(sql);
          lastInternalValue.current = sql;
        }
      }
    }
  }, [sql]);

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden group" id="sql-editor-container">
      <div className="flex items-center justify-between px-4 py-2 bg-[#fdfcff]/50 dark:bg-slate-900/50 border-b border-primary/10 dark:border-slate-800" id="sql-editor-header">
        <div className="flex items-center gap-3">
          <button 
            onClick={onRun}
            disabled={isLoading}
            className="flex items-center gap-2.5 px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
            Run Query
          </button>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
          <div className="flex items-center gap-2 text-slate-500">
            <Code size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">SQL Editor</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all shadow-sm ${isCopying ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-primary/5 border-primary/10 dark:border-slate-800'}`}
            title="Copy SQL"
          >
            {isCopying ? <Check size={14} /> : <Copy size={14} />}
            {isCopying ? 'Copied' : 'Copy'}
          </button>
          <button
            id="ai-suggest-button"
            onClick={handleAiSuggest}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-lg border border-primary/20 transition-all shadow-sm"
          >
            <Sparkles size={14} />
            AI Assist
          </button>
          <button
            id="save-query-button"
            onClick={onSave}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg border border-primary/10 dark:border-slate-800 transition-all shadow-sm"
          >
            <Save size={14} />
            Save Query
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden relative bg-transparent" id="monaco-wrapper">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme={isDarkMode ? 'colorful-dark' : 'colorful-light'}
          defaultValue={sql}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={memoizedOptions}
        />
      </div>
    </div>
  );
}
