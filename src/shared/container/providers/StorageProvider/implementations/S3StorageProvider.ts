import fs from 'fs';
import path from 'path';
import mime from 'mime';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import uploadConfig from '@config/upload';
import IStorageProvider from '../models/IStorageProvider';

class S3StorageProvider implements IStorageProvider {
  private client: S3Client;

  constructor() {
    // AWS SDK v3 (o v2 foi descontinuado pela AWS)
    this.client = new S3Client({ region: 'us-east-1' });
  }

  public async saveFile(file: string): Promise<string> {
    const originalPath = path.resolve(uploadConfig.tmpFolder, file);

    const ContentType = mime.getType(originalPath);

    if (!ContentType) {
      throw new Error('File not found');
    }

    const fileContent = await fs.promises.readFile(originalPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: uploadConfig.config.aws.bucket,
        Key: file,
        ACL: 'public-read',
        Body: fileContent,
        ContentType,
      }),
    );

    await fs.promises.unlink(originalPath);

    return file;
  }

  public async deleteFile(file: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: uploadConfig.config.aws.bucket,
        Key: file,
      }),
    );
  }
}
export default S3StorageProvider;
