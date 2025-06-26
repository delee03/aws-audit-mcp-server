#!/bin/bash

set -e

echo "🔨 Building AWS Lambda Python package..."

# Configuration
BUILD_DIR="build"
ZIP_FILE="aws-audit-mcp-server.zip"

# clean previous build
rm -rf $BUILD_DIR
rm -f $ZIP_FILE

# create build directory
mkdir -p $BUILD_DIR

echo "Copying source files..."
cp -r src/* $BUILD_DIR/
cp lambda_handler_sse.py $BUILD_DIR/

echo "Installing dependencies..."
cd $BUILD_DIR

# install dependencies for Lambda (x86_64)
pip install --platform manylinux2014_x86_64 --implementation cp --python-version 3.11 --only-binary=:all: --target . pydantic mcp httpx beautifulsoup4 markdownify loguru

# clean up
echo "Cleaning up..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.DS_Store" -delete 2>/dev/null || true

# zip package
zip -r ../$ZIP_FILE . -x "*.DS_Store*" "*/\.*"

cd ..

echo "Package created successfully: $ZIP_FILE"
echo "Package size: $(du -h $ZIP_FILE | cut -f1)"
echo "Ready for deployment with Terraform!"
