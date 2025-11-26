#!/bin/bash

echo "Setting up WhatsApp Sticker Bot for Railway deployment..."

# Step 1: Run locally to authenticate
echo "Step 1: Starting local authentication..."
echo "Please scan the QR code that appears with your WhatsApp mobile app"

npm run dev &
LOCAL_PID=$!

echo "After scanning the QR code successfully:"
echo "1. Press Ctrl+C to stop the local bot"
echo "2. Run: npm run deploy-railway"

wait $LOCAL_PID