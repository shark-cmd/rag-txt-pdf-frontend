import express from 'express';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import cors from 'cors';
import logger from './config/logger.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {}

// Configure file upload to disk with higher limits
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.originalname}`)
});

const upload = multer({
  storage,
  limits: {
    files: parseInt(process.env.UPLOAD_MAX_FILES || '1000', 10),
    fileSize: parseInt(process.env.UPLOAD_MAX_FILESIZE_BYTES || String(50 * 1024 * 1024), 10) // 50MB default
  }
});

// Initialize RAG service
let ragService;

async function initializeApp() {
  try {
    // Import RAG service dynamically
    const ragModule = await import('./services/ragService.js');
    ragService = ragModule.default;

    // Progress SSE
    const progressModule = await import('./services/progress.js');
    const { sseHandler, emitProgress, emitDone } = progressModule;
    const ingestionQueueModule = await import('./services/ingestionQueue.js');
    const ingestionQueue = ingestionQueueModule.default;

    // --- API Routes ---

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // SSE channel for progress
    app.get('/api/progress/:opId', sseHandler);

    // Ingest documents from file upload (enqueue for background processing)
    app.post('/api/documents', upload.array('document', parseInt(process.env.UPLOAD_MAX_FILES || '1000', 10)), async (req, res, next) => {
      try {
        const { opId, removeTimestamps, collectionName } = req.query;
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: 'No files uploaded' });
        }

        if (collectionName) {
          try {
            await ragService.useCollection(String(collectionName));
            emitProgress?.(opId, `Using collection: ${collectionName}`);
          } catch (err) {
            emitProgress?.(opId, `Warning: Failed to prepare collection '${collectionName}': ${err.message}`);
          }
        }

        const fileNames = req.files.map(file => file.originalname).join(', ');
        emitProgress?.(opId, `Uploading ${req.files.length} files: ${fileNames}`);

        const tasks = req.files.map((file, index) =>
          ingestionQueue.add(async () => {
            emitProgress?.(opId, `Queued file ${index + 1}/${req.files.length}: ${file.originalname}`);
            try {
              const result = await ragService.processFile([file], opId, removeTimestamps === 'true', { suppressDone: true });
              emitProgress?.(opId, `Processed: ${file.originalname}`, result);
              return result;
            } catch (err) {
              emitProgress?.(opId, `Error processing ${file.originalname}: ${err.message || String(err)}`);
              throw err;
            }
          })
        );

        // Finalize when all queued tasks are done (do not block response)
        Promise.allSettled(tasks).then((results) => {
          const success = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;
          emitProgress?.(opId, `Completed ingestion. Success: ${success}, Failed: ${failed}`);
          emitDone?.(opId, { success: failed === 0, processed: success, failed });
        }).catch((err) => {
          emitProgress?.(opId, `Error finalizing ingestion: ${err.message || String(err)}`);
          emitDone?.(opId, { success: false, error: err.message || String(err) });
        });

        res.status(202).json({ enqueued: req.files.length, collection: collectionName || ragService.collectionName });
      } catch (error) {
        next(error);
      }
    });

    // Switch default collection
    app.post('/api/collections/use', async (req, res, next) => {
      try {
        const { collectionName } = req.body;
        if (!collectionName) {
          return res.status(400).json({ error: 'collectionName is required' });
        }
        await ragService.useCollection(String(collectionName));
        res.json({ success: true, collectionName: ragService.collectionName });
      } catch (error) {
        next(error);
      }
    });

    // Ingest content from a website URL
    app.post('/api/crawl', async (req, res, next) => {
      try {
        const { url } = req.body;
        const { opId } = req.query;
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }
        emitProgress?.(opId, `Starting crawl: ${url}`);
        const result = await ragService.processWebUrl(url, opId);
        emitProgress?.(opId, `Crawl complete: ${url}`, result);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    });

    // Ingest raw text
    app.post('/api/text', async (req, res, next) => {
      try {
        const { text } = req.body;
        const { opId } = req.query;
        if (!text) {
          return res.status(400).json({ error: 'Text content is required' });
        }
        emitProgress?.(opId, `Processing text input`);
        const result = await ragService.processText(text, opId);
        emitProgress?.(opId, `Text processed`, result);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    });

    // Query endpoint
    app.post('/api/query', async (req, res, next) => {
      try {
        const { question, topK } = req.body;
        if (!question) {
          return res.status(400).json({ error: 'Question is required' });
        }
        const answer = await ragService.query(question, { topK: typeof topK === 'number' ? topK : undefined });
        res.json({ answer });
      } catch (error) {
        next(error);
      }
    });

    // List all documents endpoint
    app.get('/api/documents', async (req, res, next) => {
      try {
        const result = await ragService.listDocuments();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    // Delete document endpoint
    app.delete('/api/documents/:source', async (req, res, next) => {
      try {
        const { source } = req.params;
        if (!source) {
          return res.status(400).json({ error: 'Source is required' });
        }
        const result = await ragService.deleteDocument(decodeURIComponent(source));
        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    // Qdrant Cloud connection endpoints
    app.post('/api/qdrant-cloud/connect', async (req, res, next) => {
      try {
        const { url, apiKey, collectionName } = req.body;
        if (!url || !apiKey) {
          return res.status(400).json({ error: 'URL and API Key are required' });
        }
        const result = await ragService.connectToQdrantCloud(url, apiKey, collectionName);
        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    app.post('/api/qdrant-cloud/disconnect', async (req, res, next) => {
      try {
        const result = await ragService.disconnectFromQdrantCloud();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    app.get('/api/qdrant-cloud/status', async (req, res, next) => {
      try {
        const result = await ragService.getQdrantCloudStatus();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    // List collections
    app.get('/api/collections', async (req, res, next) => {
      try {
        const result = await ragService.listCollections();
        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      logger.error(err.stack);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
      });
    });

    // Start the server
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      console.log(`Server is running on http://localhost:${PORT}`);
    });

  } catch (error) {
    logger.error('Failed to initialize application:', error);
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Initialize the application
initializeApp().catch(error => {
  logger.error('Fatal error during initialization:', error);
  console.error('Fatal error during initialization:', error);
  process.exit(1);
});
