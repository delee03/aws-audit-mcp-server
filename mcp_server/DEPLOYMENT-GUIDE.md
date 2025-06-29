# 🚀 AWS MCP Server - Simple Deployment Guide

Step by step from build image to deploy

## 📋 Pre-requiste

- AWS CLI installed and configured
- Docker installed
- AWS account with ECR permissions
- EC2 instance with Docker support
- Domain name for HTTPS (e.g., `your-domain-name`
- Email to register SSL certificate

---

## 🔧 Step 1: Build và Test Docker Image Locally

**Why:** Ensure MCP server works before deploying to production

bash
# Test local container
./scripts/run-docker.sh

# Check response
curl http://localhost:8000/sse

# Stop container after test
docker stop aws-mcp-server

---

## 🏷️ Step 2: Tag and Push on ECR

**Why :** ECR is AWS's Docker registry, needed to store and deploy images

### 2.1 Get AWS Account Info

bash
# Get AWS account info
./scripts/get-aws-info.sh

# Copy ACCOUNT_ID and REGION from output for later steps

### 2.2 Create ECR Repository

bash
# Create ECR repo (change REGION to your region, e.g., us-east-1)
aws ecr create-repository --repository-name aws-mcp-server --region us-east-1

# Login ECR (change ACCOUNT_ID and REGION)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-
1.amazonaws.com

### 2.3 Tag and Push Image

bash
# Tag image (change <ACCOUNT_ID> by your AWS Account ID)
docker tag aws-mcp-server:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/aws-mcp-server:latest

# Push to ECR
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/aws-mcp-server:latest

# Save ECR URI for later use
echo "<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/aws-mcp-server:latest" > ecr-uri.txt

---

## 🖥️ Step 3: create EC2 Instance

**Why:** Need EC2 instance to run Docker container and host MCP server

### 3.1 Launch EC2 via AWS Console

1. Access **EC2 Console** → **Launch Instance**
2. **Name:** `mcp-server`
3. **AMI:** Ubuntu Server 22.04 LTS
4. **Instance Type:** `t3.small` (or `t2.micro` for free tier)
5. **Key Pair:** Create or select existing key pair (download `.pem` file)
6. **Security Group:** choose on your own:
   - **SSH (22):** Your IP
   - **HTTP (80):** 0.0.0.0/0
   - **HTTPS (443):** 0.0.0.0/0
   - **Custom (8000):** 0.0.0.0/0
7. **Launch Instance**

### 3.2 Save the information

bash
# Save IP of EC2 instance
echo "INSTANCE_IP=<EC2_PUBLIC_IP>" > ec2-info.txt
echo "KEY_FILE=<path_to_key_file>.pem" >> ec2-info.txt

---
## 🐳 Step 4: Setup Docker on EC2

**Why:** EC2 need Docker to run the MCP server container

### 4.1 SSH to EC2

bash
# SSH on EC2 (change <EC2_IP> and your-key.pem)
ssh -i your-key.pem ubuntu@<EC2_IP>

### 4.2 Install Docker and AWS CLI

bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Docker

```
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ubuntu
```

# Apply docker permission don't need to logout
```
newgrp docker
```
# Test Docker
```
docker --version
```

# Install AWS CLI
```
sudo apt update
sudo apt install -y unzip curl
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version

```

---

## 📥 Step 5: Pull and Run Container

**Why:** Run MCP server from ECR image built

### 5.1 Login ECR and Pull Image


bash
# Login ECR
```
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-
1.amazonaws.com
```

## This command will prompt you to enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region name (us-east-1)
- Default output format (json)

### Method 1: Using `aws configure`
```bash
aws configure
```

### Method 2: Using IAM Role for EC2 (recommended way)
1. Create an IAM Role with ECR permissions (AmazonECR-FullAccess or a custom policy)
2. Attach the IAM Role to your EC2 instance:
   - Go to the EC2 Console
   - Select your instance
   - Actions > Security > Modify IAM Role
   - Choose the IAM Role you created

### Method 3: Using environment variables
```bash
export AWS_ACCESS_KEY_ID=<your_access_key_id>
export AWS_SECRET_ACCESS_KEY=<your_secret_access_key>
export AWS_DEFAULT_REGION=us-east-1
```

# Pull image from ECR
docker pull <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/aws-mcp-server:latest

### 5.2 Run Container

bash
# Create logs folder
```
mkdir -p ~/mcp-logs
```

# Run container

```typescript
docker run -d \
 --name aws-mcp-server \
 --restart unless-stopped \
 -p 8000:8000 \
 -v ~/mcp-logs:/app/logs \
 <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/aws-mcp-server:latest
 ```

# Check container

```
docker ps
docker logs aws-mcp-server
```

# Test endpoint
```
curl http://localhost:8000/sse
```

---

## 🌐 Step 6: Setup Nginx Reverse Proxy
( Nginx handle SSL termination and proxy requests to container)

### 6.1 Install Nginx

bash
# Install nginx
```
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```
# Test nginx
```
curl http://localhost
```

### 6.2 Config Nginx (IMPORTANT)

bash
# Create config file

```
sudo tee /etc/nginx/sites-available/mcp-server.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name your-domain-name;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain-name; # Change to your domain

    ssl_certificate /etc/letsencrypt/live/your-domain-name/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain-name/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # Main SSE endpoint - only GET requests
    location = /sse {
        if ($request_method != GET) {
            return 405;
        }

        proxy_pass http://127.0.0.1:8000/sse;

        # HTTP/1.1 and connection upgrade
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE specific
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;

        # CORS
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, OPTIONS';
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
    }

    # Endpoint for POST requests (MCP messages)
    location /messages {
        proxy_pass http://127.0.0.1:8000;

        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Content-Type $content_type;

        # CORS
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
    }

    # Handle OPTIONS requests
    location / {
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
            add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 200;
        }

        return 301 /sse;
    }
}
EOF

```

# Activate config
```
sudo ln -s /etc/nginx/sites-available/mcp-server.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

# Test config
```
sudo nginx -t
```
# Reload nginx
```
sudo systemctl reload nginx
```
---

## 🔒 Step 7: Setup SSL Certificate

**Tại sao:** HTTPS is required for secure communication and MCP compatibility

### 7.1 Install Certbot

bash
# Install certbot
```
sudo apt install -y certbot python3-certbot-nginx
```

# Get SSL certificate (changes your@email.com)
```
sudo certbot --nginx -d your-domain-name --email your@email.com --agree-tos --non-interactive
```
# Setup auto-renewal
```
echo "0 12    /usr/bin/certbot renew --quiet" | sudo tee -a /etc/crontab > /dev/null
```

### 7.2 Verify SSL

bash
# Test SSL

```
sudo certbot certificates
```
# Test HTTPS (After DNS setup)
```
curl https://your-domain-name/sse

---

## 🌍 Step 8: Set up DNS

### 8.1 Add DNS Record

**Access DNS provider (Cloudflare, Route53, etc.):**

```
Type: A
Name: mcp-server
Value: <EC2PUBLIC_IP>
TTL: 300 (5 minutes)
```

### 8.2 Verify DNS

bash
# Test DNS resolution (from local)
```
nslookup your A record domain
```

# Test access
```
curl https://your-domain/sse
```
---

## ✅ Step 9: Final Verification

### 9.1 Health Checks

bash
# On EC2
```
docker ps | grep aws-mcp-server
curl http://localhost:8000/sse
curl http://localhost/sse
```
# From internet
```
curl https://your-domain-name/sse
curl https://your-domain-name/health
```

### 9.2 Test with n8n


## 🛠️ Maintenance Commands

bash
# See logs
docker logs aws-mcp-server -f

# Restart container
docker restart aws-mcp-server

# Update image
docker pull <ECR_URI>:latest
docker stop aws-mcp-server
docker rm aws-mcp-server
# Running again step 5.2

# Backup logs
tar -czf mcp-logs-backup-$(date +%Y%m%d).tar.gz ~/mcp-logs/

---

## 📝 Troubleshooting

### Container didn't start
bash
docker logs aws-mcp-server
docker inspect aws-mcp-server

### SSL certificate fail
bash
sudo certbot certificates
sudo certbot renew --dry-run

### DNS isn't resolve
bash
dig your-domain
nslookup your-domain name

---

## 🎯 Final URLs

- **Health Check:** `https://your-domain/health`
- **MCP Endpoint:** `https://your-domain/sse`
- **For n8n:** `https://your-domain/sse`

**🎉 MCP Server Production Ready!**