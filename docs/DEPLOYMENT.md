# Deployment Guide

## Overview

This guide covers deployment options for the UPI Admin Dashboard across different environments and platforms. The system features advanced Redis-based session management for instant role updates and high-performance authentication.

**Author**: Sayem Abdullah Rihan (@code-craka)  
**Contributor**: Sajjadul Islam  
**Contact**: hello@techsci.io  
**Repository**: https://github.com/code-craka/upi-payment-app

## Prerequisites

### System Requirements

- **Node.js**: 18+ (LTS recommended)
- **MongoDB**: 5.0+ with replica set support
- **Redis**: 6.2+ for session management (required for production)
- **SSL Certificate**: For production deployment
- **Domain name**: For production deployment

### Redis Requirements (Critical)

Redis is now a **mandatory requirement** for full system functionality:

- **Memory**: Minimum 512MB RAM for Redis
- **Persistence**: RDB + AOF persistence recommended
- **Clustering**: Redis Cluster support for high availability
- **Security**: AUTH password and TLS encryption for production

### Environment Variables

Ensure all required environment variables are configured:

#### Database Configuration
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/database
```

#### Redis Configuration (Required)
```env
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_TLS=true  # For production
```

#### Authentication (Clerk)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

#### Security Configuration
```env
NEXTAUTH_SECRET=your-secure-secret-key
CSRF_SECRET=your-csrf-secret-key
```

## Deployment Options

### 1. Vercel (Recommended)

#### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/upi-payment-system)

#### Manual Deployment

1. **Connect Repository**
   \`\`\`bash

   # Install Vercel CLI

   npm i -g vercel

   # Login to Vercel

   vercel login

   # Deploy

   vercel --prod
   \`\`\`

2. **Configure Environment Variables**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add all required environment variables
   - Redeploy after adding variables

3. **Database Setup**
   - Use MongoDB Atlas for production database
   - Configure connection string in environment variables
   - Set up database indexes (automatic on first run)

#### Vercel Configuration

\`\`\`json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
\`\`\`

### 2. Docker Deployment

#### Dockerfile

\`\`\`dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application

RUN corepack enable pnpm && pnpm build

# Production image, copy all the files and run next

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache

RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
\`\`\`

#### Docker Compose

\`\`\`yaml

# docker-compose.yml

version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/upi-payment-system
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongo_data:
\`\`\`

#### Deploy with Docker

\`\`\`bash

# Build and run

docker-compose up -d

# View logs

docker-compose logs -f

# Scale application

docker-compose up -d --scale app=3
\`\`\`

### 3. AWS Deployment

#### Using AWS App Runner

1. **Create App Runner Service**
   \`\`\`bash

   # Install AWS CLI

   aws configure

   # Create apprunner.yaml

   cat > apprunner.yaml << EOF
   version: 1.0
   runtime: nodejs18
   build:
     commands:
       build:
         - npm install -g pnpm
         - pnpm install
         - pnpm build
   run:
     runtime-version: 18
     command: pnpm start
     network:
       port: 3000
       env: PORT
   env:
     - name: NODE_ENV
       value: production
   EOF
   \`\`\`

2. **Deploy to App Runner**
   - Connect GitHub repository
   - Configure environment variables
   - Deploy automatically on push

#### Using ECS with Fargate

\`\`\`yaml

# ecs-task-definition.json

{
  "family": "upi-payment-system",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "your-account.dkr.ecr.region.amazonaws.com/upi-payment-system:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/upi-payment-system",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
\`\`\`

### 4. Google Cloud Platform

#### Using Cloud Run

\`\`\`yaml

# cloudbuild.yaml

steps:

- name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/upi-payment-system', '.']
- name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/upi-payment-system']
- name: 'gcr.io/cloud-builders/gcloud'
    args:
  - 'run'
  - 'deploy'
  - 'upi-payment-system'
  - '--image'
  - 'gcr.io/$PROJECT_ID/upi-payment-system'
  - '--region'
  - 'us-central1'
  - '--platform'
  - 'managed'
  - '--allow-unauthenticated'
\`\`\`

#### Deploy to Cloud Run

\`\`\`bash

# Build and deploy

gcloud builds submit --config cloudbuild.yaml

# Set environment variables

gcloud run services update upi-payment-system \
  --set-env-vars NODE_ENV=production,MONGODB_URI=your-connection-string
\`\`\`

## Database Setup

### MongoDB Atlas (Recommended)

1. Create MongoDB Atlas cluster
2. Configure network access (IP whitelist)
3. Create database user
4. Get connection string
5. Configure in environment variables

### Self-Hosted MongoDB

\`\`\`bash

# Install MongoDB

sudo apt-get install -y mongodb

# Start MongoDB

sudo systemctl start mongodb
sudo systemctl enable mongodb

# Create database and user

mongo
> use upi-payment-system
> db.createUser({
    user: "appuser",
    pwd: "securepassword",
    roles: ["readWrite"]
  })
\`\`\`

## SSL/TLS Configuration

### Let's Encrypt (Free SSL)

\`\`\`bash

# Install Certbot

sudo apt-get install certbot

# Get certificate

sudo certbot certonly --standalone -d your-domain.com

# Auto-renewal

sudo crontab -e

# Add: 0 12 ** * /usr/bin/certbot renew --quiet

\`\`\`

### Nginx Configuration

\`\`\`nginx

# nginx.conf

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

## Monitoring and Logging

### Application Monitoring

\`\`\`javascript
// Add to your app
import { Analytics } from '@vercel/analytics/react';

export default function App() {
  return (
    <>
      <YourApp />
      <Analytics />
    </>
  );
}
\`\`\`

### Error Tracking

\`\`\`javascript
// Sentry integration
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
\`\`\`

### Health Checks

\`\`\`typescript
// app/api/health/route.ts
export async function GET() {
  try {
    // Check database connection
    await mongoose.connection.db.admin().ping();

    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        auth: 'operational'
      }
    });
  } catch (error) {
    return Response.json(
      { status: 'unhealthy', error: error.message },
      { status: 503 }
    );
  }
}
\`\`\`

## Performance Optimization

### Caching Strategy

\`\`\`javascript
// Redis caching
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCachedData(key: string) {
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedData(key: string, data: any, ttl = 3600) {
  await redis.setex(key, ttl, JSON.stringify(data));
}
\`\`\`

### CDN Configuration

\`\`\`javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-cdn-domain.com'],
  },
  async headers() {
    return [
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
\`\`\`

## Backup and Recovery

### Database Backup

\`\`\`bash

# MongoDB backup script

# !/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$MONGODB_URI" --out="/backups/backup_$DATE"
tar -czf "/backups/backup_$DATE.tar.gz" "/backups/backup_$DATE"
rm -rf "/backups/backup_$DATE"

# Upload to S3

aws s3 cp "/backups/backup_$DATE.tar.gz" "s3://your-backup-bucket/"
\`\`\`

### Automated Backups

\`\`\`yaml

# GitHub Actions backup

name: Database Backup
on:
  schedule:
    - cron: '0 2 ** *'  # Daily at 2 AM

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Backup Database
        run: |
          mongodump --uri="${{ secrets.MONGODB_URI }}" --out="./backup"
          tar -czf "backup_$(date +%Y%m%d).tar.gz" backup/
      - name: Upload to S3
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: aws s3 cp backup_$(date +%Y%m%d).tar.gz s3://your-backup-bucket/
\`\`\`

## Troubleshooting

### Common Issues

1. **Build Failures**: Check Node.js version and dependencies
2. **Database Connection**: Verify connection string and network access
3. **Authentication Issues**: Check Clerk configuration
4. **Performance Issues**: Monitor database queries and caching

### Debug Mode

\`\`\`bash

# Enable debug logging

NODE_ENV=development DEBUG=* npm start
\`\`\`

### Log Analysis

\`\`\`bash

# View application logs

docker-compose logs -f app

# Search for errors

grep -i error /var/log/app.log

# Monitor real-time logs

tail -f /var/log/app.log
