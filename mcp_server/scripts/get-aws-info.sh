#!/bin/bash

echo "📋 AWS Account Information"
echo "=========================="

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "Account ID: $ACCOUNT_ID"
else
    echo "❌ AWS CLI not configured or no permissions"
    echo "Run: aws configure"
    exit 1
fi

# Get current region
REGION=$(aws configure get region 2>/dev/null)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
    echo "Region: $REGION (default)"
else
    echo "Region: $REGION"
fi

# Generate ECR URI
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/aws-mcp-server:latest"

echo ""
echo "🐳 ECR Information"
echo "=================="
echo "Repository URI: $ECR_URI"
echo ""
echo "📝 Copy these for deployment:"
echo "ACCOUNT_ID=$ACCOUNT_ID"
echo "REGION=$REGION"
echo "ECR_URI=$ECR_URI" 