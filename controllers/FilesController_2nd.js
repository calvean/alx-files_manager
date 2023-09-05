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

    if (parentId !== 0) {
      const parentFile = await collection.findOne({ _id: ObjectId(parentId) });

      if (!parentFile || parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent not found' });
      }
    }

    const file = {
      userId,
      name,
      type,
      isPublic,
      parentId,
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
};

export default FilesController;
