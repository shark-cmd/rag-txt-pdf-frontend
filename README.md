# Personal NotebookLM with Chai RAG

This project is a full-stack application that provides a personal, self-hosted alternative to services like NotebookLM. It combines a powerful Retrieval-Augmented Generation (RAG) backend with a user-friendly Next.js frontend, allowing you to create your own private knowledge base and chat with your documents.

## High-level Architecture

The application is structured as a monorepo with two main components:

-   **`backend/`**: A Node.js application built with Express that exposes a REST API for the RAG pipeline. It uses Qdrant for vector storage and Google's Gemini models for embeddings and language generation.
-   **`frontend/`**: A Next.js application that provides a web interface for interacting with the RAG system.
-   **`docs/`**: Project documentation, steps, and TODOs used as the memory bank.
-   **`rag-website-crawler/`**: A standalone TypeScript crawler used for reference; the backend now includes built-in website crawling.

## Features

-   **Chat with your documents**: Ask questions and get answers from your private knowledge base.
-   **Support for multiple ingestion types**:
    - **Upload files**: PDF, TXT, DOCX
    - **Crawl a website URL**: Fetches HTML with a desktop User-Agent, cleans it, and indexes the text
    - **Raw text input**
-   **Intelligent chunking**: Documents are intelligently chunked to preserve context.
-   **High-quality embeddings**: Uses Google's `embedding-001` for generating embeddings.
-   **Fast and scalable vector search**: Powered by the Qdrant vector database.

## Leaner Docker Images

- Backend uses a multi-stage build with production-only dependencies and runs as a non-root user on `node:20-alpine` (Node 20 includes modern Web APIs like global `fetch` and `File`).
- Frontend uses Next.js standalone output to ship only the server, static assets, and runs as a non-root user on `node:20-alpine`.
- Added `.dockerignore` files to reduce build context size for faster, smaller builds.

To rebuild with the lean images:

```bash
# From repo root
docker compose build backend frontend
docker compose up -d backend frontend
```

Note: If you see a warning that `version` is obsolete in `docker-compose.yml`, it's safe to remove the `version:` key.

## Getting Started

### Prerequisites

-   Node.js v18+
-   npm, yarn, or pnpm
-   Docker (for running Qdrant locally)
-   A Google API key with access to the Gemini API.

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2.  **Set up the backend:**

    Navigate to the `backend` directory and install the dependencies:

    ```bash
    cd backend
    npm install
    ```

    Create a `.env` file in the `backend` directory and add the following environment variables:

    ```env
    # Google Gemini API Key
    GOOGLE_API_KEY=your_google_api_key_here

    # Qdrant Configuration
    QDRANT_URL=http://localhost:6333
    QDRANT_COLLECTION=documents

    # Application Configuration
    PORT=3000
    NODE_ENV=development

    # Logging
    LOG_LEVEL=info
    ```

3.  **Set up the frontend:**

    Navigate to the `frontend` directory and install the dependencies:

    ```bash
    cd ../frontend
    npm install
    ```

### Running the Application (Manual Setup)

1.  **Start Qdrant:**

    You can run Qdrant locally using Docker:

    ```bash
    docker run -p 6333:6333 -p 6334:6334 \
        -v $(pwd)/qdrant_storage:/qdrant/storage \
        qdrant/qdrant
    ```

2.  **Start the backend:**

    In the `backend` directory, run:

    ```bash
    npm run dev
    ```

    The backend API will be available at `http://localhost:3000`.

3.  **Start the frontend:**

    In a separate terminal, in the `frontend` directory, run:

    ```bash
    npm run dev
    ```

    The frontend application will typically be available at `http://localhost:3001` (Next.js will prompt to use 3001 if 3000 is taken).

### Running with Docker Compose (Recommended)

This is the easiest way to get the entire application stack running.

1.  **Make sure you have a `.env` file** in the `backend` directory as described in the Installation section.
2.  **Run Docker Compose:**

    From the root of the project, run:

    ```bash
    docker compose up -d --build
    ```

    This will build the Docker images for the frontend and backend, and start all three services.

    -   The frontend will be available at `http://localhost:3001`.
    -   The backend will be available at `http://localhost:3000`.
    -   Qdrant will be available at `http://localhost:6333`.

## Usage

Once the application is running, open the frontend and use the left panel to ingest content:

-   **Upload File**: PDF, DOCX, or TXT
-   **Add Text**: Paste raw text and add it to your knowledge base
-   **Crawl Website**: Enter a URL; the backend will fetch using a desktop User-Agent, clean and index the content
-   **Chat**: Ask questions in the right panel; responses are grounded in your indexed data

## Project Structure

```
.
├── backend/        # Node.js/Express backend
│   ├── src/
│   ├── package.json
│   └── ...
├── frontend/       # Next.js frontend
│   ├── src/
│   ├── app/
│   ├── components/
│   └── ...
├── docs/           # Steps, TODOs, project description, settings
└── rag-website-crawler/  # Standalone reference crawler (TypeScript)
```

## API Endpoints

The backend provides the following REST API endpoints:

-   `POST /api/documents` — Upload and index a document (multipart/form-data, field `document`)
-   `POST /api/crawl` — Crawl and index a single URL (`{ url: string }`)
-   `POST /api/text` — Add raw text (`{ text: string }`)
-   `POST /api/query` — Query the RAG system (`{ question: string }`)
-   `GET /api/health` — Health check endpoint
