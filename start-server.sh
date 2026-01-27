#!/bin/bash

# Simple server startup script for SFSC Cost App

echo "Starting local server for SFSC Cost App..."
echo ""

# Check if port 3000 is available, if not try 3001, 3002, etc.
PORT=3000
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; do
    PORT=$((PORT+1))
done

echo "Server will start on port $PORT"
echo "Open your browser and visit: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd "$(dirname "$0")"

# Try Python first
if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer $PORT
# Try Node.js serve
elif command -v npx &> /dev/null; then
    npx serve -p $PORT
else
    echo "Error: Neither Python nor Node.js found. Please install one of them."
    exit 1
fi
