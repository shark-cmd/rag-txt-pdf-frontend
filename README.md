# RAG PDF Application

A Retrieval-Augmented Generation (RAG) application that uses LangChain, Qdrant, and Google Gemini to process and query PDF documents.

## Features

- PDF document processing and embedding generation
- Vector storage in Qdrant (local or cloud)
- Chat interface with context-aware responses
- Support for both local and cloud deployment
- Docker-based deployment for easy setup

## Prerequisites

- Docker and Docker Compose
- Node.js and npm (for development)
- Google API Key with Gemini access
- Supabase account and project (for chat history)
- Qdrant Cloud account (optional, for cloud mode)

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd rag-txt-pdf-frontend-cursor-analyze-code-repository-thoroughly-1430
   ```

2. **Set up environment variables:**

   Create `backend/.env`:
   ```env
   # Google API Key for Gemini
   GOOGLE_API_KEY=your_google_api_key

   # Choose mode: "local" or "cloud"
   QDRANT_MODE=local

   # Local Qdrant settings
   QDRANT_LOCAL_URL=http://qdrant:6333
   QDRANT_LOCAL_COLLECTION=pulmo

   # Cloud Qdrant settings (required only for cloud mode)
   QDRANT_CLOUD_URL=https://your-cluster-url.qdrant.tech
   QDRANT_CLOUD_API_KEY=your_qdrant_cloud_api_key
   QDRANT_CLOUD_COLLECTION=pulmo

   # Server Port
   PORT=3000

   # Directory for file uploads
   UPLOAD_DIR=uploads
   ```

   Create `frontend/.env`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Choose Deployment Mode:**

   The application supports two modes of operation:

   **Local Mode** (Default):
   - Uses a local Qdrant instance in Docker
   - Perfect for development and testing
   - Data persists in a Docker volume
   ```bash
   ./switch-mode.sh local
   ```

   **Cloud Mode**:
   - Uses Qdrant Cloud for vector storage
   - Better for production deployments
   - Requires Qdrant Cloud credentials
   ```bash
   ./switch-mode.sh cloud
   ```

4. **Start the Application:**

   Make the switch script executable:
   ```bash
   chmod +x switch-mode.sh
   ```

   Create uploads directory:
   ```bash
   mkdir uploads
   ```

   Start the services:
   ```bash
   # The script will start the appropriate services based on the selected mode
   ./switch-mode.sh local  # or cloud
   ```

## Accessing the Application

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000

## Features and Usage

1. **Document Upload**
   - Supports PDF files
   - Automatically processes and generates embeddings
   - Stores vectors in Qdrant (local or cloud)

2. **Chat Interface**
   - Ask questions about uploaded documents
   - Get context-aware responses
   - View source references for answers

3. **Vector Storage**
   - Local mode: Uses Docker volume for persistence
   - Cloud mode: Uses Qdrant Cloud for scalability

## Development Setup

1. **Backend Development:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend Development:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Switching Between Modes

You can switch between local and cloud modes at any time:

1. Update the `QDRANT_MODE` in `backend/.env`
2. If using cloud mode, ensure `QDRANT_CLOUD_URL` and `QDRANT_CLOUD_API_KEY` are set
3. Run the switch script:
   ```bash
   ./switch-mode.sh local  # or cloud
   ```

## Troubleshooting

1. **File Upload Issues**
   - Check if uploads directory exists
   - Verify permissions on uploads directory
   - Check Docker volume mounting

2. **Qdrant Connection Issues**
   - Local mode: Ensure Qdrant container is running
   - Cloud mode: Verify credentials and URL
   - Check network connectivity

3. **API Errors**
   - Verify environment variables
   - Check backend logs: `docker-compose logs backend`
   - Check Qdrant logs: `docker-compose logs qdrant`

## Architecture

- Frontend: Next.js with TypeScript
- Backend: Express.js with LangChain
- Vector Store: Qdrant (local/cloud)
- Chat History: Supabase
- LLM: Google Gemini
- Container Orchestration: Docker Compose

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
