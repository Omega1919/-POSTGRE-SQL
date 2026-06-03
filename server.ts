import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as xlsx from 'xlsx';
import admin from 'firebase-admin';

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// PostgreSQL Connection Pool
let pool: Pool | null = null;
let initPromise: Promise<Pool | null> | null = null;

async function getPool() {
  if (!pool) {
    if (!initPromise) {
      initPromise = (async () => {
        const connectionString = process.env.DATABASE_URL;
        
        if (!connectionString && !process.env.POSTGRES_HOST) {
          console.error('DATABASE_URL is not set. Please add it in the Settings menu.');
          initPromise = null;
          return null;
        }

        // Bypass TLS validation globally for local database drivers
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        try {
          let newPool: Pool;
          if (connectionString) {
            newPool = new Pool({
              connectionString,
              ssl: { rejectUnauthorized: false }
            });
          } else {
            // Fallback to individual vars if DATABASE_URL is not provided
            newPool = new Pool({
              host: process.env.POSTGRES_HOST || 'localhost',
              port: parseInt(process.env.POSTGRES_PORT || '5432'),
              user: process.env.POSTGRES_USER || 'postgres',
              password: process.env.POSTGRES_PASSWORD || 'password',
              database: process.env.POSTGRES_DATABASE || 'postgres',
              ssl: { rejectUnauthorized: false }
            });
          }

          // Test connection and initialize tables
          console.log(`Initializing PostgreSQL database`);
          
          await newPool.query('SELECT 1'); // Simple heartbeat check
          
          await newPool.query(`
            CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              firebase_uid VARCHAR(255) UNIQUE NOT NULL,
              username VARCHAR(255) NOT NULL,
              insights TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);

          await newPool.query(`
            CREATE TABLE IF NOT EXISTS saved_queries (
              id SERIAL PRIMARY KEY,
              user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              name VARCHAR(255) NOT NULL,
              query TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);

          await newPool.query(`
            CREATE TABLE IF NOT EXISTS query_history (
              id SERIAL PRIMARY KEY,
              user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              query TEXT NOT NULL,
              status VARCHAR(50) NOT NULL,
              execution_time_ms INT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);

          await newPool.query(`
            CREATE TABLE IF NOT EXISTS projects (
              id SERIAL PRIMARY KEY,
              user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              name VARCHAR(255) NOT NULL,
              insights TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, name)
            )
          `);

          await newPool.query(`
            CREATE TABLE IF NOT EXISTS table_folders (
              user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              table_name VARCHAR(255) NOT NULL,
              folder_name VARCHAR(255) NOT NULL,
              PRIMARY KEY (user_id, table_name)
            )
          `);

          await newPool.query(`
            CREATE TABLE IF NOT EXISTS typing_sessions (
              id SERIAL PRIMARY KEY,
              user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              wpm INT NOT NULL,
              accuracy INT NOT NULL,
              difficulty VARCHAR(50) NOT NULL,
              duration_seconds INT NOT NULL,
              completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);

          console.log(`PostgreSQL initialized successfully`);
          pool = newPool;
          return pool;
        } catch (err) {
          console.error('Failed to initialize PostgreSQL:', err);
          initPromise = null;
          pool = null;
          return null;
        }
      })();
    }
    return initPromise;
  }
  return pool;
}

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Middleware to verify Firebase ID Token
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const dbPool = await getPool();
      
      if (!dbPool) {
        return res.status(503).json({ 
          error: 'Database configuration missing', 
          message: 'Please set the DATABASE_URL environment variable in the Settings menu.' 
        });
      }

      // Check if user exists in our DB, if not create them
      const { rows } = await dbPool.query('SELECT * FROM users WHERE firebase_uid = $1', [decodedToken.uid]);
      let user = rows[0];

      if (!user) {
        // Create user in DB
        const username = decodedToken.name || decodedToken.email?.split('@')[0] || 'user';
        const result = await dbPool.query('INSERT INTO users (firebase_uid, username) VALUES ($1, $2) RETURNING id', [decodedToken.uid, username]);
        user = { id: result.rows[0].id, firebase_uid: decodedToken.uid, username };
      }

      req.user = user;
      next();
    } catch (err) {
      console.error('Auth Error:', err);
      return res.status(403).json({ error: 'Forbidden' });
    }
  };

  app.delete('/api/tables/:name', authenticateToken, async (req: any, res) => {
    const tableName = req.params.name;
    const internalTables = ['users', 'saved_queries', 'query_history', 'missions_progress', 'table_folders', 'projects', 'typing_sessions'];
    
    if (internalTables.includes(tableName)) {
      return res.status(403).json({ error: 'Cannot delete internal system tables' });
    }

    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      
      // Cleanup folder metadata
      await dbPool.query('DELETE FROM table_folders WHERE table_name = $1', [tableName]);
      
      // For Postgres, we use double quotes for identifiers to avoid issues with reserved words or special chars
      await dbPool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      
      res.json({ message: `Table ${tableName} deleted successfully` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DB Routes
  app.post('/api/auth/link-legacy', authenticateToken, async (req: any, res) => {
    const { username, password } = req.body;
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      
      // Find the legacy user by username and password
      const { rows: legacyRows } = await dbPool.query('SELECT * FROM users WHERE username = $1 AND password = $2 AND firebase_uid IS NULL', [username, password]);
      const legacyUser = legacyRows[0];
      
      if (!legacyUser) {
        return res.status(401).json({ error: 'Legacy account not found or already linked' });
      }

      // Start migration
      const newUserId = req.user.id;
      const oldUserId = legacyUser.id;

      // Migrate projects
      await dbPool.query('UPDATE projects SET user_id = $1 WHERE user_id = $2 ON CONFLICT DO NOTHING', [newUserId, oldUserId]);
      // Migrate saved queries
      await dbPool.query('UPDATE saved_queries SET user_id = $1 WHERE user_id = $2', [newUserId, oldUserId]);
      // Migrate history
      await dbPool.query('UPDATE query_history SET user_id = $1 WHERE user_id = $2', [newUserId, oldUserId]);
      // Migrate folder mappings
      await dbPool.query('UPDATE table_folders SET user_id = $1 WHERE user_id = $2 ON CONFLICT DO NOTHING', [newUserId, oldUserId]);
      
      // Migrate main insights if current one is empty
      if (!req.user.insights && legacyUser.insights) {
        await dbPool.query('UPDATE users SET insights = $1 WHERE id = $2', [legacyUser.insights, newUserId]);
      }

      // Mark legacy user as migrated or just delete
      await dbPool.query('DELETE FROM users WHERE id = $1', [oldUserId]);
      
      res.json({ message: 'Legacy account data migrated successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tables', authenticateToken, async (req: any, res) => {
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      
      const { rows } = await dbPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type IN ('BASE TABLE', 'VIEW')
      `);
      
      // Filter out internal tables (including typing_sessions and all other application/internal tables)
      const internalTables = ['users', 'saved_queries', 'query_history', 'missions_progress', 'table_folders', 'projects', 'typing_sessions'];
      const tables = rows.map((row: any) => row.table_name)
        .filter((t: string) => !internalTables.includes(t));
      
      // Get folder mappings
      const { rows: folders } = await dbPool.query('SELECT table_name, folder_name FROM table_folders WHERE user_id = $1', [req.user.id]);
      
      res.json({ tables, folders });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tables/:name/folder', authenticateToken, async (req: any, res) => {
    const { name } = req.params;
    const { folderName } = req.body;
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      
      if (folderName) {
        // Automatically create project if it doesn't exist
        await dbPool.query('INSERT INTO projects (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING', [req.user.id, folderName]);
        await dbPool.query(`
          INSERT INTO table_folders (user_id, table_name, folder_name) 
          VALUES ($1, $2, $3) 
          ON CONFLICT (user_id, table_name) 
          DO UPDATE SET folder_name = EXCLUDED.folder_name
        `, [req.user.id, name, folderName]);
      } else {
        await dbPool.query('DELETE FROM table_folders WHERE user_id = $1 AND table_name = $2', [req.user.id, name]);
      }
      res.json({ message: 'Folder updated successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/projects', authenticateToken, async (req: any, res) => {
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      const { rows } = await dbPool.query('SELECT * FROM projects WHERE user_id = $1 ORDER BY name ASC', [req.user.id]);
      res.json({ projects: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/projects', authenticateToken, async (req: any, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      await dbPool.query('INSERT INTO projects (user_id, name) VALUES ($1, $2)', [req.user.id, name]);
      res.json({ message: 'Project created' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/projects/:name', authenticateToken, async (req: any, res) => {
    const { name } = req.params;
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      
      // Ungroup tables in this project
      await dbPool.query('DELETE FROM table_folders WHERE user_id = $1 AND folder_name = $2', [req.user.id, name]);
      // Delete project record
      await dbPool.query('DELETE FROM projects WHERE user_id = $1 AND name = $2', [req.user.id, name]);
      
      res.json({ message: 'Project deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/lab/tables', authenticateToken, async (req, res) => {
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      
      const { rows } = await dbPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'practice_%'
      `);
      const tables = rows.map((row: any) => row.table_name);
      
      res.json({ tables });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tables/schemas/all', authenticateToken, async (req, res) => {
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      const { rows: tableRows } = await dbPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_type IN ('BASE TABLE', 'VIEW')
      `);
      
      const internalTables = ['users', 'saved_queries', 'query_history', 'missions_progress', 'table_folders', 'projects', 'typing_sessions'];
      const tables = tableRows.map((row: any) => row.table_name)
        .filter((t: string) => !internalTables.includes(t));
      
      const schemas: Record<string, any[]> = {};
      for (const table of tables as string[]) {
        const { rows: schema } = await dbPool.query(`
          SELECT column_name as "Field", data_type as "Type", is_nullable as "Null"
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table]);
        schemas[table] = schema;
      }
      res.json({ schemas });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tables/:tableName/schema', authenticateToken, async (req, res) => {
    const { tableName } = req.params;
    const internalTables = ['users', 'saved_queries', 'query_history', 'missions_progress', 'table_folders', 'projects', 'typing_sessions'];
    if (internalTables.includes(tableName)) {
      return res.status(403).json({ error: 'Access to system table schema is restricted' });
    }
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      
      const { rows } = await dbPool.query(`
        SELECT column_name as "Field", data_type as "Type", is_nullable as "Null"
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);
      res.json({ schema: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Insights API ---
  app.get('/api/user/insights', authenticateToken, async (req: any, res) => {
    const { projectName } = req.query;
    try {
      const dbPool = await getPool();
      if (!dbPool) return res.status(500).json({ error: 'Database not connected' });
      
      if (projectName) {
        const { rows } = await dbPool.query('SELECT insights FROM projects WHERE user_id = $1 AND name = $2', [req.user.id, projectName]);
        res.json({ content: rows[0]?.insights || '' });
      } else {
        const { rows } = await dbPool.query('SELECT insights FROM users WHERE id = $1', [req.user.id]);
        res.json({ content: rows[0]?.insights || '' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/user/insights', authenticateToken, async (req: any, res) => {
    const { content, projectName } = req.body;
    try {
      const dbPool = await getPool();
      if (!dbPool) return res.status(500).json({ error: 'Database not connected' });
      
      if (projectName) {
        await dbPool.query('UPDATE projects SET insights = $1 WHERE user_id = $2 AND name = $3', [content, req.user.id, projectName]);
      } else {
        await dbPool.query('UPDATE users SET insights = $1 WHERE id = $2', [content, req.user.id]);
      }
      res.json({ status: 'updated' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/query', authenticateToken, async (req: any, res) => {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL query required' });

    const startTime = Date.now();
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');

      // Basic safety: avoid destructive commands on system tables
      const upperSql = sql.trim().toUpperCase();
      const privilegeKeywords = ['GRANT', 'REVOKE'];
      if (privilegeKeywords.some(kw => upperSql.includes(kw))) {
        return res.status(403).json({ error: 'Privilege management keywords are restricted.' });
      }

      // Prevent COPY commands (file write/read and Remote Code Execution via PROGRAM)
      if (/\bCOPY\b/i.test(sql)) {
        return res.status(403).json({ error: 'The COPY command is restricted in this workspace due to security policies.' });
      }

      // Prevent Postgres admin or system-level file-access interaction functions
      const dangerousFunctions = [
        'pg_read_file', 'pg_write_file', 'pg_ls_dir', 'pg_read_binary_file', 'pg_stat_file',
        'pg_execute_server_program', 'pg_reload_conf', 'pg_rotate_logfile', 'pg_switch_wal',
        'lo_import', 'lo_export'
      ];
      const hasDangerousFunction = dangerousFunctions.some(func => {
        const regex = new RegExp(`\\b${func}\\b`, 'i');
        return regex.test(sql);
      });
      if (hasDangerousFunction) {
        return res.status(403).json({ error: 'Access to system-administration, execution, and file system functions is restricted.' });
      }

      // Restrict access to internal system and application data tables in the SQL editor (frontend workspace).
      // This enforces that these tables can only be accessed directly in the database, hidden from frontend interactions.
      const internalTables = [
        'USERS', 'SAVED_QUERIES', 'QUERY_HISTORY', 'MISSIONS_PROGRESS', 'TABLE_FOLDERS', 'PROJECTS', 'TYPING_SESSIONS',
        'PG_SHADOW', 'PG_AUTHID', 'PG_USER', 'PG_ROLES', 'PG_DATABASE', 'PG_SYSCLASS'
      ];
      const hasRestrictedAccess = internalTables.some(table => {
        const regex = new RegExp(`\\b${table}\\b`, 'i');
        return regex.test(sql);
      });
      if (hasRestrictedAccess) {
        return res.status(403).json({ 
          error: 'Querying internal system, admin, or application data tables is restricted in this workspace. These tables can only be accessed directly in the database.' 
        });
      }

      const { rows: results, fields } = await dbPool.query(sql);
      
      const executionTime = Date.now() - startTime;

      // Log history
      await dbPool.query('INSERT INTO query_history (user_id, query, status, execution_time_ms) VALUES ($1, $2, $3, $4)', 
        [req.user.id, sql, 'success', executionTime]);

      // Map pg fields to the format the frontend expects (name only)
      const mappedFields = fields.map(f => ({ name: f.name }));

      res.json({ results, fields: mappedFields, executionTime });
    } catch (err: any) {
      const executionTime = Date.now() - startTime;
      try {
        const dbPool = await getPool();
        if (dbPool) {
          await dbPool.query('INSERT INTO query_history (user_id, query, status, execution_time_ms) VALUES ($1, $2, $3, $4)', 
            [req.user.id, sql, 'error', executionTime]);
        }
      } catch (logErr) {
        console.error('Failed to log query error to history:', logErr);
      }
      res.status(400).json({ error: err.message });
    }
  });

  // Saved Queries
  app.get('/api/saved-queries', authenticateToken, async (req: any, res) => {
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      const { rows } = await dbPool.query('SELECT * FROM saved_queries WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
      res.json({ queries: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/saved-queries', authenticateToken, async (req: any, res) => {
    const { name, query } = req.body;
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      await dbPool.query('INSERT INTO saved_queries (user_id, name, query) VALUES ($1, $2, $3)', [req.user.id, name, query]);
      res.status(201).json({ message: 'Query saved' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/saved-queries/:id', authenticateToken, async (req: any, res) => {
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      await dbPool.query('DELETE FROM saved_queries WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      res.json({ message: 'Query deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Query History
  app.get('/api/history', authenticateToken, async (req: any, res) => {
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      const { rows } = await dbPool.query(
        'SELECT * FROM query_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25',
        [req.user.id]
      );
      res.json({ history: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Import Chunked Upload
  app.post('/api/import/chunk', authenticateToken, upload.single('file'), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'Chunk file required' });
    
    const { uploadId, chunkIndex } = req.body;
    if (!uploadId || chunkIndex === undefined) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'uploadId and chunkIndex are required' });
    }

    // Sanitize uploadId to prevent local directory path traversal
    const safeUploadId = path.basename(uploadId).replace(/[^a-zA-Z0-9_\-]/g, '');
    const cleanChunkIndex = parseInt(chunkIndex, 10);
    if (!safeUploadId || isNaN(cleanChunkIndex)) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid uploadId or chunkIndex' });
    }

    try {
      const chunksDir = path.join(process.cwd(), 'uploads', 'chunks', safeUploadId);
      if (!fs.existsSync(chunksDir)) {
        fs.mkdirSync(chunksDir, { recursive: true });
      }

      const chunkPath = path.join(chunksDir, cleanChunkIndex.toString());
      // Move upload file to chunks directory to preserve it
      fs.renameSync(req.file.path, chunkPath);

      res.json({ success: true, message: `Chunk ${cleanChunkIndex} uploaded successfully` });
    } catch (err: any) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/import/assemble', authenticateToken, async (req: any, res) => {
    const { uploadId, fileName, totalChunks, tableName, folderName } = req.body;
    if (!uploadId || !fileName || !totalChunks) {
      return res.status(400).json({ error: 'uploadId, fileName, and totalChunks are required' });
    }

    // Sanitize to prevent path traversal
    const safeUploadId = path.basename(uploadId).replace(/[^a-zA-Z0-9_\-]/g, '');
    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const cleanTotalChunks = parseInt(totalChunks, 10);
    const finalTableName = tableName || `table_${Date.now()}`;

    // Validate table name identifiers to prevent SQL injection
    const isValidIdentifier = (name: string) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
    if (!isValidIdentifier(finalTableName)) {
      return res.status(400).json({ error: 'Invalid table name. Only letters, numbers, and underscores are allowed, starting with a letter.' });
    }

    const chunksDir = path.join(process.cwd(), 'uploads', 'chunks', safeUploadId);
    const assembledFilePath = path.join(process.cwd(), 'uploads', `assembled_${safeUploadId}_${safeFileName}`);

    try {
      if (!fs.existsSync(chunksDir)) {
        throw new Error('Upload folder not found or expired');
      }

      // Check if all chunks are present
      for (let i = 0; i < cleanTotalChunks; i++) {
        const chunkPath = path.join(chunksDir, i.toString());
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Missing chunk index: ${i}`);
        }
      }

      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Assemble chunks
      const writeStream = fs.createWriteStream(assembledFilePath);
      
      for (let i = 0; i < cleanTotalChunks; i++) {
        const chunkPath = path.join(chunksDir, i.toString());
        const chunkBuffer = fs.readFileSync(chunkPath);
        writeStream.write(chunkBuffer);
      }
      writeStream.end();

      // Wait for write stream to finish
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (err) => reject(err));
      });

      // Cleanup chunks directory immediately to save space
      fs.rmSync(chunksDir, { recursive: true, force: true });

      // Run same parsing/insertion logic as /api/import
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');

      let data: any[] = [];
      const lowerName = safeFileName.toLowerCase();
      if (lowerName.endsWith('.csv')) {
        const fileContent = fs.readFileSync(assembledFilePath, 'utf-8');
        data = parse(fileContent, { columns: true, skip_empty_lines: true });
      } else if (lowerName.match(/\.xlsx?$/)) {
        const workbook = xlsx.readFile(assembledFilePath);
        const sheetName = workbook.SheetNames[0];
        data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      } else {
        throw new Error('Unsupported file format');
      }

      if (data.length === 0) throw new Error('File is empty');

      // Auto-detect schema and sanitize column names
      const rawColumns = Object.keys(data[0]);
      const sanitizedColumns: string[] = [];
      const seen = new Set<string>();
      
      rawColumns.forEach(col => {
        let name = col.trim()
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '');
        
        if (!name) name = 'column';
        
        let finalName = name;
        let counter = 1;
        while (seen.has(finalName.toLowerCase())) {
          finalName = `${name}_${counter}`;
          counter++;
        }
        seen.add(finalName.toLowerCase());
        sanitizedColumns.push(finalName);
      });
      
      const createTableSql = `CREATE TABLE "${finalTableName}" (${sanitizedColumns.map(col => `"${col}" TEXT`).join(', ')})`;
      await dbPool.query(createTableSql);

      // Bulk insert in batches
      for (let i = 0; i < data.length; i += 500) {
        const batch = data.slice(i, i + 500);
        const placeholders = batch.map((_, rowIndex) => 
          `(${sanitizedColumns.map((_, colIndex) => `$${rowIndex * sanitizedColumns.length + colIndex + 1}`).join(', ')})`
        ).join(', ');
        
        const flatValues = batch.flatMap(row => rawColumns.map(col => row[col]));
        const insertBatchSql = `INSERT INTO "${finalTableName}" (${sanitizedColumns.map(col => `"${col}"`).join(', ')}) VALUES ${placeholders}`;
        
        await dbPool.query(insertBatchSql, flatValues);
      }

      // Cleanup assembled file
      if (fs.existsSync(assembledFilePath)) {
        fs.unlinkSync(assembledFilePath);
      }

      // Handle folder assignment
      if (folderName) {
        await dbPool.query('INSERT INTO projects (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING', [req.user.id, folderName]);
        await dbPool.query(`
          INSERT INTO table_folders (user_id, table_name, folder_name) 
          VALUES ($1, $2, $3) 
          ON CONFLICT (user_id, table_name) 
          DO UPDATE SET folder_name = EXCLUDED.folder_name
        `, [req.user.id, finalTableName, folderName]);
      }

      res.json({ message: 'Import successful', tableName: finalTableName });
    } catch (err: any) {
      // Cleanup on error
      if (fs.existsSync(chunksDir)) {
        fs.rmSync(chunksDir, { recursive: true, force: true });
      }
      if (fs.existsSync(assembledFilePath)) {
        fs.unlinkSync(assembledFilePath);
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Import
  app.post('/api/import', authenticateToken, upload.single('file'), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'File required' });

    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');

      const filePath = req.file.path;
      let data: any[] = [];

      if (req.file.originalname.endsWith('.csv')) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        data = parse(fileContent, { columns: true, skip_empty_lines: true });
      } else if (req.file.originalname.match(/\.xlsx?$/)) {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      } else {
        throw new Error('Unsupported file format');
      }

      if (data.length === 0) throw new Error('File is empty');

      // Auto-detect schema and sanitize column names
      const rawColumns = Object.keys(data[0]);
      const sanitizedColumns: string[] = [];
      const seen = new Set<string>();
      
      rawColumns.forEach(col => {
        let name = col.trim()
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '');
        
        if (!name) name = 'column';
        
        let finalName = name;
        let counter = 1;
        while (seen.has(finalName.toLowerCase())) {
          finalName = `${name}_${counter}`;
          counter++;
        }
        seen.add(finalName.toLowerCase());
        sanitizedColumns.push(finalName);
      });

      const tableName = req.body.tableName || `table_${Date.now()}`;
      
      // Validate table name identifiers to prevent SQL injection
      const isValidIdentifier = (name: string) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
      if (!isValidIdentifier(tableName)) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Invalid table name. Only letters, numbers, and underscores are allowed, starting with a letter.' });
      }
      
      // In Postgres, identifiers are case-sensitive if double-quoted.
      const createTableSql = `CREATE TABLE "${tableName}" (${sanitizedColumns.map(col => `"${col}" TEXT`).join(', ')})`;
      await dbPool.query(createTableSql);

      // Bulk insert in batches
      for (let i = 0; i < data.length; i += 500) {
        const batch = data.slice(i, i + 500);
        const placeholders = batch.map((_, rowIndex) => 
          `(${sanitizedColumns.map((_, colIndex) => `$${rowIndex * sanitizedColumns.length + colIndex + 1}`).join(', ')})`
        ).join(', ');
        
        const flatValues = batch.flatMap(row => rawColumns.map(col => row[col]));
        const insertBatchSql = `INSERT INTO "${tableName}" (${sanitizedColumns.map(col => `"${col}"`).join(', ')}) VALUES ${placeholders}`;
        
        await dbPool.query(insertBatchSql, flatValues);
      }

      fs.unlinkSync(filePath);

      // Handle folder assignment
      const { folderName } = req.body;
      if (folderName) {
        await dbPool.query('INSERT INTO projects (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING', [req.user.id, folderName]);
        await dbPool.query(`
          INSERT INTO table_folders (user_id, table_name, folder_name) 
          VALUES ($1, $2, $3) 
          ON CONFLICT (user_id, table_name) 
          DO UPDATE SET folder_name = EXCLUDED.folder_name
        `, [req.user.id, tableName, folderName]);
      }

      res.json({ message: 'Import successful', tableName });
    } catch (err: any) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: err.message });
    }
  });

  // Typing speed trainer sessions
  app.get('/api/typing', authenticateToken, async (req: any, res) => {
    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      const { rows } = await dbPool.query(
        'SELECT * FROM typing_sessions WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 100',
        [req.user.id]
      );
      res.json({ sessions: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/typing', authenticateToken, async (req: any, res) => {
    const { wpm, accuracy, difficulty, duration_seconds } = req.body;
    
    if (wpm === undefined || accuracy === undefined || !difficulty || duration_seconds === undefined) {
      return res.status(400).json({ error: 'All parameters (wpm, accuracy, difficulty, duration_seconds) are required' });
    }

    try {
      const dbPool = await getPool();
      if (!dbPool) throw new Error('Database not connected');
      const { rows } = await dbPool.query(
        'INSERT INTO typing_sessions (user_id, wpm, accuracy, difficulty, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.id, Math.round(wpm), Math.round(accuracy), difficulty, Math.round(duration_seconds)]
      );
      res.status(201).json({ session: rows[0], message: 'Session saved successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
