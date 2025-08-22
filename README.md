# Personal NotebookLM - Hitesh Choudhary Edition

A beautiful, modern RAG (Retrieval-Augmented Generation) application featuring Hitesh Choudhary's unique teaching style and personality. This AI-powered knowledge assistant helps you create your own personal knowledge base by ingesting documents, websites, and text, then querying it with natural language in Hitesh's characteristic Hinglish communication style.

## ✨ Features

- **Hitesh Choudhary's Teaching Style**: Authentic Hinglish communication with chai analogies and cultural references
- **No-Spoon-Feeding Approach**: Guidance-based learning that encourages independent problem-solving
- **Beautiful Modern UI**: Glassmorphism design with gradient backgrounds and smooth animations
- **Multi-format Document Ingestion**: Upload PDF, DOCX, TXT, MD, CSV, VTT, and SRT files
- **Multiple File Upload**: Process multiple files simultaneously for efficient batch processing
- **Recursive Website Crawling**: Automatically discover and index all sub-pages of a website
- **Real-time Progress Tracking**: Live updates during ingestion with Server-Sent Events (SSE)
- **Document Management**: View, refresh, and delete sources from the database
- **Natural Language Queries**: Ask questions about your knowledge base in conversational Hinglish
- **Source Attribution**: See which documents were used to generate answers
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🎨 UI Design

The application features a stunning glassmorphism design inspired by modern AI interfaces:

- **Gradient Backgrounds**: Beautiful purple-to-slate gradients with subtle patterns
- **Glassmorphism Effects**: Translucent panels with backdrop blur and subtle borders
- **Smooth Animations**: Hover effects, loading states, and micro-interactions
- **Modern Icons**: Lucide React icons throughout the interface
- **Progress Visualization**: Real-time progress bars and status indicators
- **Color-coded Actions**: Different gradient buttons for different actions (blue for text, green for crawling, etc.)

## 🏗️ High-level Architecture

```
├── frontend/                 # Next.js frontend with beautiful UI
├── backend/                  # Express.js API server
├── docs/                     # Documentation and project files
├── FIGMA_SAMPLE/            # Design reference and components
└── docker-compose.yml       # Container orchestration
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Valid Google API key for Gemini AI
- Node.js 18+ (for local development)

### Environment Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd chai-rag-feat-add-nextjs-frontend
   ```

2. **Set up environment variables**:
   Create `backend/.env`:
   ```env
   GOOGLE_API_KEY=your_google_api_key_here
   QDRANT_URL=http://qdrant:6333
   QDRANT_COLLECTION=documents
   PORT=3000
   ```

3. **Start the application**:
   ```bash
   # Build and start all services
   docker compose build
   docker compose up -d
   ```

4. **Access the application**:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000
   - Qdrant Vector DB: http://localhost:6333

## 🛠️ Technology Stack

### Backend
- **Node.js & Express**: Fast, unopinionated web framework
- **LangChain**: LLM framework for RAG implementation
- **Google Gemini AI**: Advanced language model for embeddings and chat
- **Qdrant**: High-performance vector database
- **Cheerio**: Server-side HTML parsing for web crawling
- **pdf-parse & mammoth**: Document parsing for PDF and DOCX files

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe JavaScript development
- **Tailwind CSS**: Utility-first styling with custom design system
- **Glassmorphism**: Modern UI effects with backdrop blur and transparency
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Real-time Updates**: SSE integration for live progress tracking

### API Endpoints

- `POST /api/text` - Add raw text content
- `POST /api/crawl` - Recursively crawl a website
- `POST /api/documents` - Upload and process files
- `POST /api/query` - Query the knowledge base
- `GET /api/documents` - List all documents in the database
- `DELETE /api/documents/:source` - Delete a specific document
- `GET /api/progress/:opId` - SSE endpoint for progress updates

## 🌟 Website Crawling Features

The recursive website crawler includes:

- **Link Discovery**: Automatically finds and follows internal links
- **Domain Filtering**: Only crawls pages within the same domain
- **Robots.txt Support**: Respects website crawling policies
- **Rate Limiting**: Configurable delays between requests (1 second default)
- **Page Limits**: Maximum 50 pages per crawl to prevent infinite loops
- **Content Extraction**: Cleans HTML and extracts meaningful text content
- **Error Handling**: Gracefully handles failed requests and continues crawling
- **Flexible URL Matching**: Handles URL encoding variations and trailing slashes

## 📊 Progress Tracking

Real-time progress updates include:

- **Overall Progress**: Percentage-based progress bar
- **Step-by-step Updates**: Detailed status for each operation
- **Visual Indicators**: Icons showing completed, active, and pending steps
- **Error Reporting**: Clear error messages with retry options
- **Auto-refresh**: Document list updates automatically after ingestion

## 🗂️ Document Management

The Sources panel provides:

- **Document Overview**: Shows titles, URLs, and chunk counts
- **Clickable Links**: Direct access to web sources
- **Delete Functionality**: Remove individual documents from the database with flexible URL matching
- **Refresh Capability**: Manual refresh of the document list
- **Loading States**: Visual feedback during operations
- **Error Handling**: Improved error messages for failed operations

## 🐳 Docker Configuration

### Leaner Images

The Docker setup has been optimized for size and performance:

- **Multi-stage Builds**: Separate build and runtime stages
- **Production Dependencies**: Only necessary packages included
- **Non-root Users**: Enhanced security with dedicated users
- **Node.js 20**: Latest LTS version with global APIs
- **Next.js Standalone**: Optimized output for containerized deployments

### Services

- **Frontend**: Next.js application on port 3001
- **Backend**: Express.js API on port 3000
- **Qdrant**: Vector database on port 6333

## 🔒 Security Features

- **Environment Variables**: Secure configuration management
- **Non-root Containers**: Enhanced container security
- **Input Validation**: Server-side validation of all inputs
- **Error Handling**: Graceful error handling without information leakage
- **Rate Limiting**: Protection against abuse

## 🎯 Ingestion Behaviors

### File Processing
- **PDF**: Direct text extraction using pdf-parse
- **DOCX**: Raw text extraction using mammoth
- **TXT/MD**: UTF-8 text processing for plain text and markdown files
- **CSV**: Tabular data conversion to readable text format
- **VTT/SRT**: Subtitle file processing with optional timestamp removal
- **Multiple Files**: Batch processing of up to 10 files simultaneously
- **Chunking**: 1000-character chunks with 200-character overlap

### Website Crawling
- **Recursive Discovery**: Finds all internal links automatically
- **Content Cleaning**: Removes scripts, styles, and navigation elements
- **Text Extraction**: Converts HTML to clean, readable text
- **Metadata Preservation**: Maintains source URLs and page titles
- **Robust Error Handling**: Continues crawling even if individual pages fail

### Text Processing
- **Direct Input**: Immediate processing of typed text
- **Chunking**: Automatic text splitting for optimal retrieval
- **Metadata**: Source tracking for attribution

## 🚀 Performance Optimizations

- **Vector Indexing**: Efficient similarity search with Qdrant
- **Chunked Storage**: Optimal document splitting for retrieval
- **Lazy Loading**: Progressive loading of UI components
- **Caching**: Intelligent caching of frequently accessed data
- **Background Processing**: Non-blocking ingestion operations

## 🔧 Recent Fixes & Improvements

### Crawler Issues Resolved
- **Fixed delay function conflict**: Resolved naming conflict between delay property and method
- **Improved error handling**: Better error messages and graceful failure handling
- **Enhanced URL matching**: Flexible matching for document deletion with URL variations

### Frontend Enhancements
- **Restored Sources Panel**: Added back the sources management panel in the sidebar
- **Better Error Display**: Improved error message formatting and user feedback
- **Enhanced Progress Tracking**: Real-time updates with detailed status information

### Backend Improvements
- **Flexible Document Deletion**: Handles URL encoding variations and trailing slashes
- **Better Debugging**: Logs available sources when deletion fails
- **Robust URL Matching**: Multiple matching strategies for document identification
- **Multiple File Processing**: Support for batch uploading and processing up to 10 files
- **Extended Format Support**: Added CSV, VTT, and SRT file format processing
- **Timestamp Control**: Optional timestamp removal for subtitle files to preserve timing information
- **Hitesh Choudhary Persona**: Integrated authentic Hinglish teaching style with chai analogies and cultural references

## 📝 Development

### Local Development

1. Clone the repository
2. Install dependencies: `npm install` in both frontend and backend
3. Set up environment variables
4. Start services: `docker compose up -d`
5. Access the application at http://localhost:3001

### Building for Production

```bash
# Build all services
docker compose build

# Start in production mode
docker compose -f docker-compose.yml up -d
```

### Troubleshooting

- **Crawler Issues**: Check the backend logs for detailed error messages
- **Document Deletion**: Verify URL encoding and try refreshing the sources list
- **API Errors**: Check the health endpoint at `/api/health`
- **Vector Database**: Ensure Qdrant is running and accessible

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Google Gemini AI** for powerful language model capabilities
- **LangChain** for the excellent RAG framework
- **Qdrant** for high-performance vector storage
- **Next.js** for the modern React framework
- **Tailwind CSS** for the utility-first styling approach
