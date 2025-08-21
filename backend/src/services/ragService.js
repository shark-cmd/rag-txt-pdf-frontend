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

    this.chatModel = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'gemini-1.5-flash',
      temperature: 0.3,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  async processWebUrl(url) {
    try {
      logger.info(`Processing website: ${url}`);

      // Fetch HTML with a desktop User-Agent and timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Failed to fetch URL (${response.status} ${response.statusText})`);
      }

      const html = await response.text();

      // Load and clean DOM
      const $ = cheerio.load(html);
      $('script, style, nav, footer, header, iframe, noscript, svg').remove();

      // Prefer main/article, fallback to body
      const mainHtml = $('main').html() || $('article').html() || $('body').html() || '';

      // Convert HTML to plain text
      const textContent = htmlToText(mainHtml, {
        wordwrap: false,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' },
        ],
      });

      // Extract title
      const title = $('title').text().trim() || 'Untitled Document';

      // Build documents and persist
      const docs = [
        new Document({
          pageContent: textContent,
          metadata: { source: url, title },
        }),
      ];

      const chunks = await this.textSplitter.splitDocuments(docs);
      await this.vectorStore.addDocuments(chunks);
      logger.info(`Successfully processed and stored content from ${url}`);
      return { success: true, chunksAdded: chunks.length };
    } catch (error) {
      logger.error(`Error processing URL ${url}: ${error.message}`);
      throw error;
    }
  }

  async processFile(file) {
    try {
      logger.info(`Processing file: ${file.originalname}`);

      const { mimetype, buffer, originalname } = file;
      let textContent = '';

      if (mimetype === 'application/pdf') {
        // Dynamic import from the library path to avoid module-side file reads
        const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
        const pdfParse = pdfModule.default || pdfModule;
        const data = await pdfParse(buffer);
        textContent = data.text || '';
      } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value || '';
      } else if (mimetype === 'text/plain') {
        textContent = buffer.toString('utf8');
      } else {
        throw new Error('Unsupported file type');
      }

      if (!textContent || !textContent.trim()) {
        throw new Error('No extractable text content found in file');
      }

      const docs = [
        new Document({ pageContent: textContent, metadata: { source: originalname } }),
      ];
      const chunks = await this.textSplitter.splitDocuments(docs);
      await this.vectorStore.addDocuments(chunks);

      logger.info(`Successfully processed and stored content from ${originalname}`);
      return { success: true, chunksAdded: chunks.length };
    } catch (error) {
      logger.error(`Error processing file ${file.originalname}: ${error.message}`);
      throw error;
    }
  }

  async processText(text) {
    try {
      logger.info(`Processing raw text input.`);
      const docs = [new Document({ pageContent: text, metadata: { source: 'raw-text' } })];
      const chunks = await this.textSplitter.splitDocuments(docs);
      await this.vectorStore.addDocuments(chunks);
      logger.info(`Successfully processed and stored raw text input.`);
      return { success: true, chunksAdded: chunks.length };
    } catch (error) {
      logger.error(`Error processing raw text: ${error.message}`);
      throw error;
    }
  }

  async query(query) {
    try {
      logger.info(`Executing query: ${query}`);
      const retriever = this.vectorStore.asRetriever();

      const prompt = ChatPromptTemplate.fromTemplate(`Answer the following question based only on the provided context:

<context>
{context}
</context>

Question: {input}`);

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
}

export default new RAGService();
