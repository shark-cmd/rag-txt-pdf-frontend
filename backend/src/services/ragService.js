// Core LangChain imports
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Document } from '@langchain/core/documents';

// Document loaders from '@langchain/community'
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
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
      const loader = new CheerioWebBaseLoader(url);
      const docs = await loader.load();
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
      const blob = new Blob([file.buffer], { type: file.mimetype });
      let loader;

      if (file.mimetype === 'application/pdf') {
        loader = new PDFLoader(blob);
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        loader = new DocxLoader(blob);
      } else if (file.mimetype === 'text/plain') {
        // Directly create a Document from the text Blob to avoid TextLoader import issues
        const textContent = await blob.text();
        const docs = [new Document({ pageContent: textContent, metadata: { source: file.originalname } })];
        const chunks = await this.textSplitter.splitDocuments(docs);
        await this.vectorStore.addDocuments(chunks);
        logger.info(`Successfully processed and stored content from ${file.originalname}`);
        return { success: true, chunksAdded: chunks.length };
      } else {
        throw new Error('Unsupported file type');
      }

      const docs = await loader.load();
      const chunks = await this.textSplitter.splitDocuments(docs);
      await this.vectorStore.addDocuments(chunks);

      logger.info(`Successfully processed and stored content from ${file.originalname}`);
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
