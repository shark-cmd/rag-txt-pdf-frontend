#!/bin/bash

# Script to switch between local and cloud Qdrant modes

MODE=${1:-"local"}  # Default to local if no argument provided

if [ "$MODE" != "local" ] && [ "$MODE" != "cloud" ]; then
    echo "Error: Mode must be either 'local' or 'cloud'"
    echo "Usage: ./switch-mode.sh [local|cloud]"
    exit 1
fi

# Update .env file
sed -i "s/QDRANT_MODE=.*/QDRANT_MODE=$MODE/" ./backend/.env

# Export for docker-compose
export QDRANT_MODE=$MODE

echo "Switching to $MODE mode..."

# Stop any running containers
docker-compose down

if [ "$MODE" == "local" ]; then
    echo "Starting with local Qdrant instance..."
    docker-compose --profile local up -d --build --remove-orphans
else
    echo "Starting in cloud mode..."
    echo "Make sure you have configured QDRANT_CLOUD_URL and QDRANT_CLOUD_API_KEY in backend/.env"
    docker-compose up -d --build --remove-orphans backend frontend
fi

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 5

# Check service status
docker-compose ps

echo "Mode switched to: $MODE"
echo "The application should be available at:"
echo "Frontend: http://localhost:3001"
echo "Backend:  http://localhost:3000"