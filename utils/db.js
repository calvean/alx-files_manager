import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}/${database}`;

    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.connection = null;
    this.isAlive = false;

    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      this.connection = this.client.db();
      this.isAlive = true;
      console.log('MongoDB connected');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      this.isAlive = false;
    }
  }

  async nbUsers() {
    try {
      const collection = this.connection.collection('users');
      const count = await collection.countDocuments();
      return count;
    } catch (error) {
      console.error('Error counting documents in "users" collection:', error);
      return 0;
    }
  }

  async nbFiles() {
    try {
      const collection = this.connection.collection('files');
      const count = await collection.countDocuments();
      return count;
    } catch (error) {
      console.error('Error counting documents in "files" collection:', error);
      return 0;
    }
  }
}

const dbClient = new DBClient();

export default dbClient;
