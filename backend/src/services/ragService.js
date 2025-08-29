// Core LangChain imports
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Document } from '@langchain/core/documents';

// Replace LangChain loaders with lightweight parsing utilities
import * as cheerio from 'cheerio';
import { htmlToText } from 'html-to-text';
// NOTE: Avoid top-level import of pdf-parse due to module-side file reads in some versions
import mammoth from 'mammoth';
import logger from '../config/logger.js';
import { emitProgress, emitDone } from './progress.js';
import websiteCrawler from './websiteCrawler.js';
import { SYSTEM_PROMPT, QUERY_PROMPT } from '../prompts/systemPrompt.js';
import { getModelConfig } from '../config/promptConfig.js';

class RAGService {
  constructor() {
    this.collectionName = process.env.QDRANT_COLLECTION || 'documents';
    this.isUsingCloud = false;
    this.cloudConfig = null;

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'embedding-001',
    });

    this.vectorStore = new QdrantVectorStore(this.embeddings, {
      url: process.env.QDRANT_URL,
      collectionName: this.collectionName,
    });

    this.chatModel = new ChatGoogleGenerativeAI(getModelConfig());

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 200,
      separators: [
        '\n\n\n',  // Triple line breaks for major sections
        '\n\n',    // Double line breaks for paragraphs
        '\n',      // Single line breaks for lines
        '. ',      // Sentences
        '! ',      // Exclamations
        '? ',      // Questions
        '; ',      // Semicolons
        ', ',      // Commas
        ' ',       // Words
        ''         // Characters
      ],
    });

    // Initialize the collection
    this.initializeCollection();
  }

  // Initialize the Qdrant collection if it doesn't exist
  async initializeCollection() {
    try {
      logger.info(`Initializing Qdrant collection: ${this.collectionName}`);
      
      // Check if collection exists
      const collections = await this.vectorStore.client.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        logger.info(`Creating collection: ${this.collectionName}`);
        await this.vectorStore.client.createCollection(this.collectionName, {
          vectors: {
            size: 768, // Google embedding-001 dimension
            distance: 'Cosine'
          }
        });
        logger.info(`Collection ${this.collectionName} created successfully`);
      } else {
        logger.info(`Collection ${this.collectionName} already exists`);
      }
    } catch (error) {
      logger.error(`Error initializing collection: ${error.message}`);
      // Don't throw here - let the service continue
    }
  }

  // Helper function to process subtitle files with better structure preservation
  processSubtitleContent(content, fileType, removeTimestamps) {
    const lines = content.split('\n');
    const processedLines = [];

    if (fileType === 'vtt') {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (removeTimestamps) {
          // Skip timestamp lines, WEBVTT header, sequence numbers, and empty lines
          if (line &&
            !line.includes('-->') &&
            !line.startsWith('WEBVTT') &&
            !line.match(/^\d+$/) &&
            !line.match(/^\d{2}:\d{2}:\d{2}\.\d{3}/)) {
            processedLines.push(line);
          }
        } else {
          // Keep all lines except WEBVTT header and empty lines
          if (line && !line.startsWith('WEBVTT')) {
            processedLines.push(line);
          }
        }
      }
    } else if (fileType === 'srt') {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (removeTimestamps) {
          // Skip timestamp lines, sequence numbers, and empty lines
          if (line &&
            !line.includes('-->') &&
            !line.match(/^\d+$/) &&
            !line.match(/^\d{2}:\d{2}:\d{2},\d{3}/)) {
            processedLines.push(line);
          }
        } else {
          // Keep all lines except empty lines
          if (line) {
            processedLines.push(line);
          }
        }
      }
    }

    return processedLines.join('\n');
  }

  // Helper function to improve text formatting for better readability
  improveTextFormatting(text) {
    if (!text) return text;

    let formattedText = text;

    // Add line breaks after numbered sections (1. 2. 3. etc.)
    formattedText = formattedText.replace(/(\*\*?\d+\.\s+[^*\n]+?\*\*?)/g, '\n\n$1\n');

    // Add line breaks after bullet points
    formattedText = formattedText.replace(/(•\s+[^\n]+)/g, '$1\n');

    // Add line breaks after bold headers
    formattedText = formattedText.replace(/(\*\*[^*]+\*\*)/g, '\n\n$1\n');

    // Add line breaks between sentences that are too close together
    formattedText = formattedText.replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2');

    // Clean up excessive line breaks
    formattedText = formattedText.replace(/\n{4,}/g, '\n\n\n');

    // Ensure proper spacing around timestamps
    formattedText = formattedText.replace(/(\(\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}\))/g, '\n$1\n');

    // Add spacing after code snippets
    formattedText = formattedText.replace(/(`[^`]+`)/g, '$1 ');

    // Ensure proper paragraph breaks
    formattedText = formattedText.replace(/([.!?])\s+(\*\*)/g, '$1\n\n$2');

    // Add line breaks after timestamps in the format "00:00:17.960 - 00:00:24.000:"
    formattedText = formattedText.replace(/(\d{2}:\d{2}:\d{2}\.\d{3}\s*-\s*\d{2}:\d{2}:\d{2}\.\d{3}:)/g, '\n$1\n');

    // Add line breaks after "Like *chai*" and similar phrases
    formattedText = formattedText.replace(/(Like\s+\*[^*]+\*[^.!?]*[.!?])/g, '$1\n');

    // Add line breaks after "So *flexible*" and similar phrases
    formattedText = formattedText.replace(/(So\s+\*[^*]+\*[^.!?]*[.!?])/g, '$1\n');

    // Add line breaks after "Now go *code*" and similar phrases
    formattedText = formattedText.replace(/(Now\s+go\s+\*[^*]+\*[^.!?]*[.!?])/g, '$1\n');

    // Add line breaks after "Arre yaar!" and similar exclamations
    formattedText = formattedText.replace(/(Arre\s+[^.!?]*[.!?])/g, '$1\n');

    // Add line breaks after "Let's see why" and similar phrases
    formattedText = formattedText.replace(/(Let's\s+see\s+why[^.!?]*[.!?])/g, '$1\n');

    // Add line breaks after "chal!" and similar phrases
    formattedText = formattedText.replace(/(chal![^.!?]*[.!?])/g, '$1\n');

    // Add line breaks after "dekho" and similar phrases
    formattedText = formattedText.replace(/(dekho[^.!?]*[.!?])/g, '$1\n');

    // Add line breaks after "yaar!" and similar phrases
    formattedText = formattedText.replace(/(yaar![^.!?]*[.!?])/g, '$1\n');

    // Clean up multiple consecutive line breaks
    formattedText = formattedText.replace(/\n{3,}/g, '\n\n');

    // Manual formatting for common patterns
    formattedText = formattedText.replace(/(\*\*Step \d+[^*]*\*\*)/g, '\n\n$1\n');
    formattedText = formattedText.replace(/(\*\*[^*]+?\*\*)/g, '\n\n$1\n');
    formattedText = formattedText.replace(/(```[\s\S]*?```)/g, '\n\n$1\n\n');

    // Add line breaks after periods followed by spaces
    formattedText = formattedText.replace(/\.\s+/g, '.\n\n');

    // Clean up excessive line breaks again
    formattedText = formattedText.replace(/\n{4,}/g, '\n\n');

    return formattedText.trim();
  }

  async processWebUrl(url, opId) {
    try {
      logger.info(`Processing website: ${url}`);
      emitProgress?.(opId, 'Starting recursive website crawl...');

      // Use the recursive website crawler
      const crawlResult = await websiteCrawler.crawlWebsite(url, opId);

      if (!crawlResult.success || !crawlResult.pages || crawlResult.pages.length === 0) {
        throw new Error('No pages were successfully crawled');
      }

      emitProgress?.(opId, `Processing ${crawlResult.pages.length} pages for embeddings...`);

      // Process all crawled pages
      const allDocs = [];
      const sources = [];

      for (let i = 0; i < crawlResult.pages.length; i++) {
        const page = crawlResult.pages[i];
        emitProgress?.(opId, `Processing page ${i + 1}/${crawlResult.pages.length}: ${page.title}`);

        if (page.textContent && page.textContent.trim()) {
          const doc = new Document({
            pageContent: page.textContent,
            metadata: {
              source: page.url,
              title: page.title,
              crawlIndex: i,
              totalPages: crawlResult.pages.length
            },
          });
          allDocs.push(doc);
          sources.push({ url: page.url, title: page.title });
        }
      }

      if (allDocs.length === 0) {
        throw new Error('No extractable content found from crawled pages');
      }

      emitProgress?.(opId, 'Chunking all pages...');
      const chunks = await this.textSplitter.splitDocuments(allDocs);

      emitProgress?.(opId, `Storing ${chunks.length} chunks from ${allDocs.length} pages`);
      await this.vectorStore.addDocuments(chunks);

      logger.info(`Successfully processed and stored content from ${crawlResult.pagesProcessed} pages of ${url}`);
      emitDone?.(opId, {
        chunksAdded: chunks.length,
        pagesProcessed: crawlResult.pagesProcessed,
        sources
      });

      return {
        success: true,
        chunksAdded: chunks.length,
        pagesProcessed: crawlResult.pagesProcessed,
        sources
      };
    } catch (error) {
      logger.error(`Error processing URL ${url}: ${error.message}`);
      emitProgress?.(opId, `Error: ${error.message}`);
      throw error;
    }
  }

  async processFile(files, opId, removeTimestamps = false) {
    try {
      const fileArray = Array.isArray(files) ? files : [files];
      let totalChunks = 0;
      const allSources = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const { originalname, mimetype, buffer } = file;

        emitProgress?.(opId, `Processing file ${i + 1}/${fileArray.length}: ${originalname}`);

        let textContent = '';

        if (mimetype === 'application/pdf') {
          emitProgress?.(opId, 'Extracting text from PDF');
          // Dynamic import from the library path to avoid module-side file reads
          const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
          const pdfParse = pdfModule.default || pdfModule;
          const data = await pdfParse(buffer);
          textContent = data.text || '';
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          emitProgress?.(opId, 'Extracting text from DOCX');
          const result = await mammoth.extractRawText({ buffer });
          textContent = result.value || '';
        } else if (mimetype === 'text/plain' || originalname.endsWith('.txt') || originalname.endsWith('.md')) {
          emitProgress?.(opId, 'Reading text file');
          textContent = buffer.toString('utf8');
        } else if (mimetype === 'text/csv' || originalname.endsWith('.csv')) {
          emitProgress?.(opId, 'Processing CSV file');
          const csvText = buffer.toString('utf8');
          // Convert CSV to readable text format
          const lines = csvText.split('\n');
          const processedLines = lines.map(line => {
            // Split by comma and clean up each field
            const fields = line.split(',').map(field => field.trim().replace(/"/g, ''));
            return fields.join(' | ');
          });
          textContent = processedLines.join('\n');
        } else if (originalname.endsWith('.vtt')) {
          emitProgress?.(opId, `Processing VTT subtitle file${removeTimestamps ? ' (removing timestamps)' : ' (keeping timestamps)'}`);
          const vttText = buffer.toString('utf8');
          textContent = this.processSubtitleContent(vttText, 'vtt', removeTimestamps);
        } else if (originalname.endsWith('.srt')) {
          emitProgress?.(opId, `Processing SRT subtitle file${removeTimestamps ? ' (removing timestamps)' : ' (keeping timestamps)'}`);
          const srtText = buffer.toString('utf8');
          textContent = this.processSubtitleContent(srtText, 'srt', removeTimestamps);
        } else {
          throw new Error(`Unsupported file type: ${mimetype} (${originalname})`);
        }

        if (!textContent || !textContent.trim()) {
          emitProgress?.(opId, `Warning: No extractable content found in ${originalname}`);
          continue;
        }

        emitProgress?.(opId, `Chunking content from ${originalname}`);
        const docs = [
          new Document({ pageContent: textContent, metadata: { source: originalname } }),
        ];
        const chunks = await this.textSplitter.splitDocuments(docs);
        totalChunks += chunks.length;
        allSources.push({ file: originalname });

        emitProgress?.(opId, `Storing ${chunks.length} chunks from ${originalname}`);
        await this.vectorStore.addDocuments(chunks);
      }

      if (totalChunks === 0) {
        throw new Error('No extractable text content found in any of the uploaded files');
      }

      logger.info(`Successfully processed and stored content from ${fileArray.length} files`);
      emitDone?.(opId, { chunksAdded: totalChunks, sources: allSources });
      return { success: true, chunksAdded: totalChunks, sources: allSources };
    } catch (error) {
      logger.error(`Error processing files: ${error.message}`);
      emitProgress?.(opId, `Error: ${error.message}`);
      throw error;
    }
  }

  async processText(text, opId) {
    try {
      logger.info(`Processing raw text input.`);
      emitProgress?.(opId, 'Chunking text');
      const docs = [new Document({ pageContent: text, metadata: { source: 'raw-text' } })];
      const chunks = await this.textSplitter.splitDocuments(docs);
      emitProgress?.(opId, `Storing ${chunks.length} chunks`);
      await this.vectorStore.addDocuments(chunks);
      logger.info(`Successfully processed and stored raw text input.`);
      emitDone?.(opId, { chunksAdded: chunks.length, sources: [{ source: 'raw-text' }] });
      return { success: true, chunksAdded: chunks.length };
    } catch (error) {
      logger.error(`Error processing raw text: ${error.message}`);
      emitProgress?.(opId, `Error: ${error.message}`);
      throw error;
    }
  }

  async query(query) {
    try {
      logger.info(`Executing query: ${query}`);
      const retriever = this.vectorStore.asRetriever();

      const prompt = ChatPromptTemplate.fromTemplate(QUERY_PROMPT);

      const documentChain = await createStuffDocumentsChain({
        llm: this.chatModel,
        prompt,
      });

      const retrievalChain = await createRetrievalChain({
        combineDocsChain: documentChain,
        retriever,
      });

      const result = await retrievalChain.invoke({
        input: query,
      });

      // Improve the formatting of the response
      const formattedResponse = this.improveTextFormatting(result.answer);

      return {
        success: true,
        response: formattedResponse,
        sources: result.context,
      };
    } catch (error) {
      logger.error(`Error during query: ${error.message}`);
      throw error;
    }
  }

  async listDocuments() {
    try {
      logger.info('Listing all documents in collection');

      // Check if collection exists first
      try {
        const collections = await this.vectorStore.client.getCollections();
        const collectionExists = collections.collections.some(
          col => col.name === this.collectionName
        );

        if (!collectionExists) {
          logger.info(`Collection ${this.collectionName} does not exist yet`);
          return {
            success: true,
            documents: [],
            totalChunks: 0
          };
        }
      } catch (error) {
        logger.warn(`Could not check collection status: ${error.message}`);
        // Continue and try to list documents anyway
      }

      // Get all points from the collection
      const allPoints = await this.vectorStore.client.scroll(this.collectionName, {
        limit: 1000, // Adjust if you have more documents
        with_payload: true,
        with_vectors: false, // Don't need vectors for listing
      });

      // Extract unique sources from metadata
      const sources = new Map();

      if (allPoints.points) {
        for (const point of allPoints.points) {
          if (point.payload && point.payload.metadata) {
            const metadata = point.payload.metadata;
            const source = metadata.source || 'Unknown';
            const title = metadata.title || source;

            if (!sources.has(source)) {
              sources.set(source, {
                source,
                title,
                chunks: 0,
                lastUpdated: metadata.timestamp || 'Unknown'
              });
            }

            sources.get(source).chunks++;
          }
        }
      }

      const documents = Array.from(sources.values());
      logger.info(`Found ${documents.length} unique documents with ${allPoints.points?.length || 0} total chunks`);

      return {
        success: true,
        documents,
        totalChunks: allPoints.points?.length || 0
      };
    } catch (error) {
      // If it's a "Not Found" error, return empty result instead of throwing
      if (error.message === 'Not Found' || error.message.includes('404')) {
        logger.info('Collection is empty or not accessible, returning empty result');
        return {
          success: true,
          documents: [],
          totalChunks: 0
        };
      }
      
      logger.error(`Error listing documents: ${error.message}`);
      throw error;
    }
  }

  async deleteDocument(source) {
    try {
      logger.info(`Deleting document: ${source}`);

      // Get all points from the collection
      const allPoints = await this.vectorStore.client.scroll(this.collectionName, {
        limit: 1000,
        with_payload: true,
        with_vectors: false,
      });

      if (!allPoints.points) {
        throw new Error('No documents found in database');
      }

      // Find points that match the source (with flexible matching)
      const pointsToDelete = [];
      const normalizedSource = decodeURIComponent(source).toLowerCase();

      for (const point of allPoints.points) {
        if (point.payload && point.payload.metadata && point.payload.metadata.source) {
          const storedSource = decodeURIComponent(point.payload.metadata.source).toLowerCase();

          // Try exact match first, then try without trailing slashes
          if (storedSource === normalizedSource ||
            storedSource.replace(/\/$/, '') === normalizedSource.replace(/\/$/, '') ||
            storedSource === normalizedSource.replace(/\/$/, '') ||
            storedSource.replace(/\/$/, '') === normalizedSource) {
            pointsToDelete.push(point.id);
          }
        }
      }

      if (pointsToDelete.length === 0) {
        // Log available sources for debugging
        const availableSources = new Set();
        for (const point of allPoints.points) {
          if (point.payload && point.payload.metadata && point.payload.metadata.source) {
            availableSources.add(point.payload.metadata.source);
          }
        }
        logger.warn(`Available sources: ${Array.from(availableSources).slice(0, 5).join(', ')}...`);
        throw new Error(`No documents found with source: ${source}`);
      }

      // Delete the points
      await this.vectorStore.client.delete(this.collectionName, {
        points: pointsToDelete
      });

      logger.info(`Successfully deleted ${pointsToDelete.length} chunks for source: ${source}`);

      return {
        success: true,
        deletedChunks: pointsToDelete.length,
        source
      };
    } catch (error) {
      logger.error(`Error deleting document ${source}: ${error.message}`);
      throw error;
    }
  }

  // Qdrant Cloud connection management
  async connectToQdrantCloud(url, apiKey, collectionName = 'documents') {
    try {
      logger.info('Connecting to Qdrant Cloud...');

      // Test the connection by creating a new vector store instance
      const cloudVectorStore = new QdrantVectorStore(this.embeddings, {
        url: url,
        apiKey: apiKey,
        collectionName: collectionName,
      });

      // Test the connection by trying to list collections
      await cloudVectorStore.client.getCollections();

      // If successful, update the current vector store
      this.vectorStore = cloudVectorStore;
      this.collectionName = collectionName;
      this.isUsingCloud = true;
      this.cloudConfig = { url, apiKey, collectionName };

      logger.info(`Successfully connected to Qdrant Cloud at ${url}`);

      return {
        success: true,
        message: 'Successfully connected to Qdrant Cloud',
        url: url,
        collectionName: collectionName
      };
    } catch (error) {
      logger.error(`Failed to connect to Qdrant Cloud: ${error.message}`);
      throw new Error(`Failed to connect to Qdrant Cloud: ${error.message}`);
    }
  }

  async disconnectFromQdrantCloud() {
    try {
      logger.info('Disconnecting from Qdrant Cloud...');

      // Reconnect to local Qdrant
      this.vectorStore = new QdrantVectorStore(this.embeddings, {
        url: process.env.QDRANT_URL,
        collectionName: process.env.QDRANT_COLLECTION || 'documents',
      });

      this.isUsingCloud = false;
      this.cloudConfig = null;
      this.collectionName = process.env.QDRANT_COLLECTION || 'documents';

      logger.info('Successfully disconnected from Qdrant Cloud');

      return {
        success: true,
        message: 'Successfully disconnected from Qdrant Cloud'
      };
    } catch (error) {
      logger.error(`Failed to disconnect from Qdrant Cloud: ${error.message}`);
      throw new Error(`Failed to disconnect from Qdrant Cloud: ${error.message}`);
    }
  }

  async getQdrantCloudStatus() {
    try {
      return {
        success: true,
        isUsingCloud: this.isUsingCloud,
        config: this.cloudConfig ? {
          url: this.cloudConfig.url,
          collectionName: this.cloudConfig.collectionName
        } : null
      };
    } catch (error) {
      logger.error(`Error getting Qdrant Cloud status: ${error.message}`);
      throw error;
    }
  }
}

export default new RAGService();
