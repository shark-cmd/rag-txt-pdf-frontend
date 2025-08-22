# Personal NotebookLM - AI-Powered Knowledge Assistant

A beautiful, modern RAG (Retrieval-Augmented Generation) application that allows you to create your own personal knowledge base by ingesting documents, websites, and text, then querying it with natural language.

## ✨ Features

- **Beautiful Modern UI**: Glassmorphism design with gradient backgrounds and smooth animations
- **Multi-format Document Ingestion**: Upload PDF, DOCX, and TXT files
- **Recursive Website Crawling**: Automatically discover and index all sub-pages of a website
- **Real-time Progress Tracking**: Live updates during ingestion with Server-Sent Events (SSE)
- **Document Management**: View, refresh, and delete sources from the database
- **Natural Language Queries**: Ask questions about your knowledge base
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
- Google API key for Gemini AI

### Environment Setup

1. Create a `.env` file in the root directory:
```bash
GOOGLE_API_KEY=your_google_api_key_here
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=documents
PORT=3000
```

2. Start all services:
```bash
docker compose up -d --build
```

3. Access the application:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Qdrant Vector DB: http://localhost:6333

## 📖 Usage

### Adding Content

1. **Text Input**: Type or paste text directly into the "Add Text" section
2. **Website Crawling**: Enter a URL to recursively crawl and index all pages
3. **File Upload**: Upload PDF, DOCX, or TXT files from the bottom of the sidebar

### Managing Sources

- **View Sources**: All indexed documents appear in the "Sources" panel
- **Refresh**: Click the refresh button to update the document list
- **Delete**: Click the ✗ button next to any source to remove it
- **Progress Tracking**: Real-time updates show ingestion progress

### Chat Interface

- **Ask Questions**: Type natural language questions about your knowledge base
- **Source Attribution**: See which documents were used to generate answers
- **Real-time Responses**: Get instant AI-powered responses with source links

## 🔧 Technical Details

### Backend Services

- **Express.js API**: RESTful endpoints for ingestion and querying
- **LangChain**: RAG pipeline with Google Gemini integration
- **Qdrant Vector Store**: High-performance vector database
- **Server-Sent Events**: Real-time progress updates
- **File Processing**: Direct parsing of PDF, DOCX, and TXT files
- **Web Crawling**: Recursive crawling with robots.txt support and rate limiting

### Frontend Features

- **Next.js 14**: Modern React framework with App Router
- **TypeScript**: Full type safety throughout the application
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
- **Delete Functionality**: Remove individual documents from the database
- **Refresh Capability**: Manual refresh of the document list
- **Loading States**: Visual feedback during operations

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
- **TXT**: UTF-8 text processing
- **Chunking**: 1000-character chunks with 200-character overlap

### Website Crawling
- **Recursive Discovery**: Finds all internal links automatically
- **Content Cleaning**: Removes scripts, styles, and navigation elements
- **Text Extraction**: Converts HTML to clean, readable text
- **Metadata Preservation**: Maintains source URLs and page titles

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

## 📝 Development

### Local Development

1. Clone the repository
2. Install dependencies: `npm install` in both frontend and backend
3. Set up environment variables
4. Run development servers:
   - Frontend: `npm run dev` (port 3001)
   - Backend: `npm run dev` (port 3000)

### Building for Production

```bash
# Build all services
docker compose build

# Start production environment
docker compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Google Gemini**: AI model and embeddings
- **LangChain**: RAG framework and components
- **Qdrant**: Vector database
- **Next.js**: React framework
- **Tailwind CSS**: Styling framework
- **FIGMA_SAMPLE**: Beautiful UI design inspiration

---

**Note**: This application is designed for personal use and knowledge management. Ensure you have proper permissions when crawling websites and respect robots.txt files.
