import { auth as firebaseAuth } from './firebase';

const API_BASE = '/api';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const user = firebaseAuth.currentUser;
  let token = null;
  
  try {
    token = user ? await user.getIdToken() : null;
  } catch (err) {
    console.error('Failed to get auth token:', err);
    throw new Error('Authentication failed. Please refresh the page.');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch(`${API_BASE}${url}`, { 
      ...options, 
      headers,
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);

    if (response.status === 401) {
      throw new Error('Unauthorized');
    }

    const contentType = response.headers.get('content-type');
    let data: any;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // If not JSON, it's likely an HTML error page or plain text
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text.substring(0, 100) || `Request failed (${response.status})`);
      }
      return text;
    }
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  }
}

export const db = {
  getTables: () => fetchWithAuth('/tables'),
  getTableSchemas: () => fetchWithAuth('/tables/schemas/all'),
  getTableSchema: (tableName: string) => fetchWithAuth(`/tables/${tableName}/schema`),
  runQuery: (sql: string) => fetchWithAuth('/query', { method: 'POST', body: JSON.stringify({ sql }) }),
  getSavedQueries: () => fetchWithAuth('/saved-queries'),
  saveQuery: (name: string, query: string) => fetchWithAuth('/saved-queries', { method: 'POST', body: JSON.stringify({ name, query }) }),
  deleteQuery: (id: number) => fetchWithAuth(`/saved-queries/${id}`, { method: 'DELETE' }),
  getInsights: (projectName?: string) => fetchWithAuth(`/user/insights${projectName ? `?projectName=${encodeURIComponent(projectName)}` : ''}`),
  saveInsight: (content: string, projectName?: string) => fetchWithAuth('/user/insights', { method: 'POST', body: JSON.stringify({ content, projectName }) }),
  deleteTable: (tableName: string) => fetchWithAuth(`/tables/${encodeURIComponent(tableName)}`, { method: 'DELETE' }),
  updateTableFolder: (tableName: string, folderName: string | null) => fetchWithAuth(`/tables/${tableName}/folder`, { method: 'POST', body: JSON.stringify({ folderName }) }),
  getProjects: () => fetchWithAuth('/projects'),
  createProject: (name: string) => fetchWithAuth('/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteProject: (name: string) => fetchWithAuth(`/projects/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  getHistory: () => fetchWithAuth('/history'),
  getTypingSessions: () => fetchWithAuth('/typing'),
  saveTypingSession: (session: { wpm: number; accuracy: number; difficulty: string; duration_seconds: number }) => 
    fetchWithAuth('/typing', { method: 'POST', body: JSON.stringify(session) }),
  importFile: async (
    file: File,
    tableName?: string,
    folderName?: string,
    onProgress?: (percent: number) => void
  ) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    
    // For small files under 5MB, upload in one single request to maintain speed
    if (file.size <= CHUNK_SIZE) {
      return new Promise(async (resolve, reject) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          if (tableName) formData.append('tableName', tableName);
          if (folderName) formData.append('folderName', folderName);
          
          const user = firebaseAuth.currentUser;
          const token = user ? await user.getIdToken() : null;

          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}/import`);
          
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }

          if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
              }
            });
          }

          xhr.addEventListener('load', () => {
            let data: any;
            try {
              data = JSON.parse(xhr.responseText);
            } catch (err) {
              data = { error: xhr.responseText || 'Import failed' };
            }

            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || 'Import failed'));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Network error during file upload.')));
          xhr.addEventListener('abort', () => reject(new Error('Upload aborted.')));
          xhr.send(formData);
        } catch (err) {
          reject(err);
        }
      });
    }

    // Larger files: Chunked Upload
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    const user = firebaseAuth.currentUser;
    const token = user ? await user.getIdToken() : null;

    // Track state of chunk uploads to report fluid loading progression
    const chunkBytesUploaded: number[] = Array(totalChunks).fill(0);

    const uploadChunk = (chunkIndex: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkSlice = file.slice(start, end);

        const formData = new FormData();
        formData.append('file', chunkSlice);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/import/chunk`);
        
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            chunkBytesUploaded[chunkIndex] = e.loaded;
            if (onProgress) {
              const totalLoaded = chunkBytesUploaded.reduce((sum, val) => sum + val, 0);
              // Cap at 99% during loading, and set to 100% on successful final assembly
              const percent = Math.min(Math.round((totalLoaded / file.size) * 100), 99);
              onProgress(percent);
            }
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Force progress updated to full size of chunk on success
            chunkBytesUploaded[chunkIndex] = end - start;
            resolve();
          } else {
            let resData: any;
            try {
              resData = JSON.parse(xhr.responseText);
            } catch (err) {
              resData = { error: xhr.responseText || 'Chunk upload failed' };
            }
            reject(new Error(resData.error || 'Chunk upload failed'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error during chunk upload.')));
        xhr.addEventListener('abort', () => reject(new Error('Chunk upload aborted.')));
        xhr.send(formData);
      });
    };

    // Upload chunks one by one
    for (let i = 0; i < totalChunks; i++) {
      await uploadChunk(i);
    }

    if (onProgress) {
      onProgress(99); // Ensure we show 99% before the assemble call initiates
    }

    // Request the server to assemble all chunks and insert into Postgres
    const assembleRes = await fetch(`${API_BASE}/import/assemble`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        uploadId,
        fileName: file.name,
        totalChunks,
        tableName,
        folderName,
      })
    });

    const assembleData = await assembleRes.json();
    if (!assembleRes.ok) {
      throw new Error(assembleData.error || 'Assembling chunks failed.');
    }

    if (onProgress) {
      onProgress(100);
    }

    return assembleData;
  },
};

export const auth = {
  logout: () => firebaseAuth.signOut(),
  linkLegacy: (credentials: any) => fetchWithAuth('/auth/link-legacy', { method: 'POST', body: JSON.stringify(credentials) }),
};
