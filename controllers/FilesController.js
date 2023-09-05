import { ObjectId } from 'mongodb';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

// Create the folder path if it doesn't exist
if (!fs.existsSync(FOLDER_PATH)) {
  fs.mkdirSync(FOLDER_PATH, { recursive: true });
}

const FilesController = {
  postUpload: async (req, res) => {
    const { 'x-token': token } = req.headers;
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const collection = dbClient.connection.collection('files');
    const parentObjectId = parentId === 0 ? 0 : ObjectId(parentId);
    const parentFile = await collection.findOne({ _id: parentObjectId });

    if (parentId !== 0 && !parentFile) {
      return res.status(400).json({ error: 'Parent not found' });
    }

    if (parentId !== 0 && parentFile.type !== 'folder') {
      return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const file = {
      userId,
      name,
      type,
      isPublic,
      parentId: parentObjectId,
    };

    if (type !== 'folder') {
      const fileData = Buffer.from(data, 'base64');
      const fileId = uuidv4();
      const filePath = `${FOLDER_PATH}/${fileId}`;

      fs.writeFileSync(filePath, fileData);

      file.localPath = filePath;
    }

    const result = await collection.insertOne(file);

    return res.status(201).json({
      id: result.insertedId.toString(),
      ...file,
    });
  },

  getShow: async (req, res) => {
    const { 'x-token': token } = req.headers;
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const collection = dbClient.connection.collection('files');
    const file = await collection.findOne({ _id: ObjectId(id), userId: ObjectId(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  },

  getIndex: async (req, res) => {
    const { 'x-token': token } = req.headers;
    let { parentId, page } = req.query;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const collection = dbClient.connection.collection('files');

    // Convert parentId to ObjectId if it is provided
    if (parentId) {
      parentId = ObjectId(parentId);
    } else {
      parentId = 0; // Set parentId to 0 (root) if not provided
    }

    // Convert page to number and set it to 0 if not provided
    page = page ? parseInt(page, 10) : 0;

    // Pagination
    const pageSize = 20;
    const skip = page * pageSize;

    const files = await collection
      .aggregate([
        { $match: { userId: ObjectId(userId), parentId } },
        { $skip: skip },
        { $limit: pageSize },
      ])
      .toArray();

    return res.status(200).json(files);
  },

  putPublish: async (req, res) => {
    const { 'x-token': token } = req.headers;
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const collection = dbClient.connection.collection('files');
    const file = await collection.findOne({ _id: ObjectId(id), userId: ObjectId(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await collection.updateOne({ _id: ObjectId(id) }, { $set: { isPublic: true } });

    return res.status(200).json(file);
  },

  putUnpublish: async (req, res) => {
    const { 'x-token': token } = req.headers;
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const collection = dbClient.connection.collection('files');
    const file = await collection.findOne({ _id: ObjectId(id), userId: ObjectId(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic) {
      return res.status(400).json({ error: 'File is not published yet' });
    }

    await collection.updateOne({ _id: ObjectId(id) }, { $set: { isPublic: false } });

    return res.status(200).json(file);
  },
  // eslint-disable-next-line consistent-return
  getFile: async (req, res) => {
    const { 'x-token': token } = req.headers;
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const collection = dbClient.connection.collection('files');
    const file = await collection.findOne({ _id: ObjectId(id) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check if the file is public or the authenticated user is the owner
    if (!file.isPublic && userId !== file.userId.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check if the file is a folder
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    // Check if the file is locally present
    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Read the file content and send it in the response
    const fileContent = fs.readFileSync(file.localPath);

    const mimeType = mime.lookup(file.name) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);

    return res.status(200).send(fileContent);
  },
};

export default FilesController;
