const MongoClient = require('mongodb').MongoClient;

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'files_manager';

// Collection Name
const collectionName = 'users';
const collectionName_2 = 'files';

// Clear all data in the collection
MongoClient.connect(url, function(err, client) {
  if (err) {
    console.error('Failed to connect to MongoDB:', err);
    return;
  }

  const db = client.db(dbName);
  const collection = db.collection(collectionName);

  collection.deleteMany({}, function(err, result) {
    if (err) {
      console.error('Failed to delete documents:', err);
      client.close();
      return;
    }

    console.log('Deleted', result.deletedCount, 'documents from', collectionName);
    client.close();
  });
});

MongoClient.connect(url, function(err, client) {
  if (err) {
    console.error('Failed to connect to MongoDB:', err);
    return;
  }

  const db = client.db(dbName);
  const collection = db.collection(collectionName_2);

  collection.deleteMany({}, function(err, result) {
    if (err) {
      console.error('Failed to delete documents:', err);
      client.close();
      return;
    }

    console.log('Deleted', result.deletedCount, 'documents from', collectionName);
    client.close();
  });
});
