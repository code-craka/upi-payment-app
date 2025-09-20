# ================================
# VERCEL ENVIRONMENT VARIABLES SETUP
# ================================
# Copy these environment variables to your Vercel dashboard
# Go to: https://vercel.com/techsci/upi-admin-dashboard/settings/environment-variables

# ===========================================
# 1. DATABASE (REQUIRED)
# ===========================================
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database

# ===========================================
# 2. UPSTASH REDIS (REQUIRED)
# ===========================================
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token-here

# ===========================================
# 3. CLERK AUTHENTICATION (REQUIRED)
# ===========================================
CLERK_SECRET_KEY=sk_test_or_live_key_here
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_or_live_key_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# ===========================================
# 4. CLERK WEBHOOKS (REQUIRED)
# ===========================================
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# ===========================================
# 5. SECURITY (REQUIRED)
# ===========================================
NEXTAUTH_SECRET=your-super-secret-key-for-session-security-min-32-chars
CSRF_SECRET=your-csrf-secret-key-here

# ===========================================
# 6. UPI PAYMENT DETAILS (REQUIRED)
# ===========================================
UPI_ID=your-upi-id@bank
MERCHANT_NAME=Your Business Name
MERCHANT_CODE=your-merchant-code

# ===========================================
# 7. APPLICATION CONFIG (REQUIRED)
# ===========================================
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
NODE_ENV=production

# ===========================================
# 8. OPTIONAL PERFORMANCE SETTINGS
# ===========================================
BENCHMARK_MAX_CONCURRENT_USERS=200
BENCHMARK_DEFAULT_ITERATIONS=1000
BENCHMARK_TIMEOUT_MS=30000

# ===========================================
# DEPLOYMENT INSTRUCTIONS:
# ===========================================
# 1. Go to: https://vercel.com/techsci/upi-admin-dashboard/settings/environment-variables
# 2. Add each variable above (replace with your actual values)
# 3. Set all variables for "Production", "Preview", and "Development" environments
# 4. After adding all variables, redeploy: `vercel --prod`