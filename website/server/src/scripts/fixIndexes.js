const mongoose = require('mongoose');
require('dotenv').config();

async function fixMongoDBIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI;
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    
    // Get the sessions collection
    const db = mongoose.connection.db;
    const sessionsCollection = db.collection('sessions');
    
    // Check existing indexes
    console.log('Checking existing indexes...');
    const indexes = await sessionsCollection.indexes();
    console.log('Current indexes:', indexes);
    
    // Look for problematic sessionId index
    const sessionIdIndex = indexes.find(index => 
      index.key && index.key.sessionId === 1
    );
    
    if (sessionIdIndex) {
      console.log('Found problematic sessionId index, dropping it...');
      await sessionsCollection.dropIndex('sessionId_1');
      console.log('Index dropped successfully');
    } else {
      console.log('No problematic sessionId index found');
    }
    
    // Create a helpful index for metadata.clientSessionId
    console.log('Creating index for metadata.clientSessionId...');
    await sessionsCollection.createIndex(
      { 'metadata.clientSessionId': 1 },
      { unique: false } // Non-unique index
    );
    console.log('Index created successfully');
    
    // Output final indexes
    const updatedIndexes = await sessionsCollection.indexes();
    console.log('Updated indexes:', updatedIndexes);
    
    console.log('Index fix completed successfully');
  } catch (error) {
    console.error('Error fixing indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixMongoDBIndexes(); 