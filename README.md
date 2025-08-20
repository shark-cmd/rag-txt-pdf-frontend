# Personal NotebookLM with Chai RAG

This project is a full-stack application that provides a personal, self-hosted alternative to services like NotebookLM. It combines a powerful Retrieval-Augmented Generation (RAG) backend with a user-friendly Next.js frontend, allowing you to create your own private knowledge base and chat with your documents.

## High-level Architecture

The application is structured as a monorepo with two main components:

-   **`backend/`**: A Node.js application built with Express that exposes a REST API for the RAG pipeline. It uses Qdrant for vector storage and Google's Gemini models for embeddings and language generation.
-   **`frontend/`**: A Next.js application that provides a web interface for interacting with the RAG system.

## Features

-   **Chat with your documents**: Ask questions and get answers from your private knowledge base.
-   **Support for multiple file types**: Upload PDF, TXT, and DOCX files.
-   **Text input**: Add raw text to your knowledge base directly from the web interface.
-   **Intelligent chunking**: Documents are intelligently chunked to preserve context.
-   **High-quality embeddings**: Uses Google's `text-embedding-004` model for generating embeddings.
-   **Fast and scalable vector search**: Powered by the Qdrant vector database.

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

    The frontend application will be available at `http://localhost:3001` (or the next available port).

### Running with Docker Compose (Recommended)

This is the easiest way to get the entire application stack running.

1.  **Make sure you have a `.env` file** in the `backend` directory as described in the Installation section.
2.  **Run Docker Compose:**

    From the root of the project, run:

    ```bash
    docker-compose up --build
    ```

    This will build the Docker images for the frontend and backend, and start all three services.

    -   The frontend will be available at `http://localhost:3001`.
    -   The backend will be available at `http://localhost:3000`.
    -   Qdrant will be available at `http://localhost:6333`.

## Usage

Once the application is running, you can access the web interface in your browser.

-   **Add documents**: Use the "Upload File" button to upload your documents.
-   **Add text**: Paste text into the text area and click "Add Text" to add it to your knowledge base.
-   **Chat**: Type your questions into the chat input and get answers from your documents.

## Project Structure

```
.
├── backend/        # Node.js/Express backend
│   ├── src/
│   ├── package.json
│   └── ...
└── frontend/       # Next.js frontend
    ├── src/
    ├── app/
    ├── components/
    └── ...
```

## API Endpoints

The backend provides the following REST API endpoints:

-   `POST /api/documents`: Upload and index a document.
-   `POST /api/query`: Query the RAG system.
-   `GET /api/collection`: Get information about the current collection.
-   `DELETE /api/collection`: Clear the collection (only available in development).
-   `GET /api/health`: Health check endpoint.
