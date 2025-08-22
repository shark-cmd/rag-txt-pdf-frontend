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
    });
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
          // Extract text content from VTT format
          const lines = vttText.split('\n');
          const textLines = lines.filter(line => {
            if (removeTimestamps) {
              // Skip timestamp lines, WEBVTT header, and empty lines
              return line.trim() &&
                !line.includes('-->') &&
                !line.startsWith('WEBVTT') &&
                !line.match(/^\d+$/) &&
                !line.match(/^\d{2}:\d{2}:\d{2}\.\d{3}/);
            } else {
              // Keep all lines except WEBVTT header and empty lines
              return line.trim() && !line.startsWith('WEBVTT');
            }
          });
          textContent = textLines.join('\n');
        } else if (originalname.endsWith('.srt')) {
          emitProgress?.(opId, `Processing SRT subtitle file${removeTimestamps ? ' (removing timestamps)' : ' (keeping timestamps)'}`);
          const srtText = buffer.toString('utf8');
          // Extract text content from SRT format
          const lines = srtText.split('\n');
          const textLines = lines.filter(line => {
            if (removeTimestamps) {
              // Skip timestamp lines, numbering, and empty lines
              return line.trim() &&
                !line.includes('-->') &&
                !line.match(/^\d+$/) &&
                !line.match(/^\d{2}:\d{2}:\d{2},\d{3}/);
            } else {
              // Keep all lines except empty lines
              return line.trim();
            }
          });
          textContent = textLines.join('\n');
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

      return {
        success: true,
        response: result.answer,
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
}

export default new RAGService();
