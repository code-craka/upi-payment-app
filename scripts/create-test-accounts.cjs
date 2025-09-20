#!/usr/bin/env node

/**
 * Bootstrap script to create test accounts for development
 * This script bypasses authentication requirements to create initial users
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// User Schema (simplified version)
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  name: String,
  role: {
    type: String,
    enum: ['admin', 'merchant', 'user'],
    default: 'user',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLoginAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model('User', UserSchema);

// Test accounts to create
const testAccounts = [
  {
    email: 'admin@test.com',
    password: 'admin123456',
    name: 'Test Admin',
    role: 'admin',
  },
  {
    email: 'merchant@test.com',
    password: 'merchant123456',
    name: 'Test Merchant',
    role: 'merchant',
  },
  {
    email: 'user@test.com',
    password: 'user123456',
    name: 'Test User',
    role: 'user',
  },
];

async function createTestAccounts() {
  try {
    console.log('🚀 Creating test accounts...\n');

    for (const account of testAccounts) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: account.email });

      if (existingUser) {
        console.log(`⚠️  User ${account.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(account.password, saltRounds);

      // Create user
      const newUser = new User({
        email: account.email,
        passwordHash,
        name: account.name,
        role: account.role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await newUser.save();

      console.log(`✅ Created ${account.role} account:`);
      console.log(`   Email: ${account.email}`);
      console.log(`   Password: ${account.password}`);
      console.log(`   Name: ${account.name}`);
      console.log(`   Role: ${account.role}\n`);
    }

    console.log('🎉 Test accounts created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('=====================================');
    testAccounts.forEach(account => {
      console.log(`${account.role.toUpperCase()}:`);
      console.log(`  Email: ${account.email}`);
      console.log(`  Password: ${account.password}\n`);
    });

  } catch (error) {
    console.error('❌ Error creating test accounts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Main execution
async function main() {
  console.log('🛠️  Bootstrap Script: Creating Test Accounts');
  console.log('==========================================\n');

  await connectDB();
  await createTestAccounts();

  process.exit(0);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

module.exports = { createTestAccounts, connectDB };