import express from 'express';
import multer from 'multer';
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

// Configure file upload
const upload = multer({ storage: multer.memoryStorage() });

// Initialize RAG service
let ragService;

async function initializeApp() {
  try {
    // Import RAG service dynamically
    const ragModule = await import('./services/ragService.js');
    ragService = ragModule.default;
    
    // --- API Routes ---
    
    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Ingest a document from file upload
    app.post('/api/documents', upload.single('document'), async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        const result = await ragService.processFile(req.file);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    });

    // Ingest content from a website URL
    app.post('/api/crawl', async (req, res, next) => {
      try {
        const { url } = req.body;
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }
        const result = await ragService.processWebUrl(url);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    });

    // Ingest raw text
    app.post('/api/text', async (req, res, next) => {
      try {
        const { text } = req.body;
        if (!text) {
          return res.status(400).json({ error: 'Text content is required' });
        }
        const result = await ragService.processText(text);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    });

    // Query endpoint
    app.post('/api/query', async (req, res, next) => {
      try {
        const { question } = req.body;
        if (!question) {
          return res.status(400).json({ error: 'Question is required' });
        }
        const answer = await ragService.query(question);
        res.json({ answer });
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
