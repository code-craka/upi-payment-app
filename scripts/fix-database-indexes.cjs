#!/usr/bin/env node

/**
 * Script to fix database indexes - removes old Clerk indexes
 */

const mongoose = require('mongoose');
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

async function fixIndexes() {
  try {
    console.log('🔧 Fixing database indexes...\n');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // List current indexes
    console.log('📋 Current indexes:');
    const indexes = await collection.listIndexes().toArray();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Drop clerkId index if it exists
    try {
      await collection.dropIndex('clerkId_1');
      console.log('\n✅ Dropped clerkId_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('\n⚠️  clerkId_1 index does not exist');
      } else {
        console.log('\n❌ Error dropping clerkId_1 index:', error.message);
      }
    }

    // Drop any other Clerk-related indexes
    try {
      const clerkIndexes = indexes.filter(index =>
        index.name.toLowerCase().includes('clerk')
      );

      for (const index of clerkIndexes) {
        if (index.name !== '_id_') { // Don't drop the _id index
          try {
            await collection.dropIndex(index.name);
            console.log(`✅ Dropped ${index.name} index`);
          } catch (error) {
            console.log(`❌ Error dropping ${index.name}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.log('❌ Error checking for Clerk indexes:', error.message);
    }

    // List indexes after cleanup
    console.log('\n📋 Indexes after cleanup:');
    const updatedIndexes = await collection.listIndexes().toArray();
    updatedIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n🎉 Database indexes fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Main execution
async function main() {
  console.log('🛠️  Database Index Cleanup Script');
  console.log('==================================\n');

  await connectDB();
  await fixIndexes();

  process.exit(0);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}