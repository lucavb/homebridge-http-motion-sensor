#!/bin/bash

# Build the plugin first
echo "Building plugin..."
npm run build

# Create temporary directory and copy config
mkdir -p .tmp
cp test-config.json .tmp/config.json

echo "Starting Homebridge for manual testing..."
echo "Motion Sensor 1: http://localhost:18089"
echo "Motion Sensor 2: http://localhost:18090"
echo "Homebridge UI: http://localhost:51826"
echo ""
echo "Test with: curl http://localhost:18089/trigger"
echo "Press Ctrl+C to stop"

# Run homebridge with temporary directory
homebridge -D -U .tmp -P .

echo "Cleaning up..."
rm -rf .tmp 