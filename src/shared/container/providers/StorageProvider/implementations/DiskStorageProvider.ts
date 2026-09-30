import fs from 'fs';
import path from 'path';
import uploadConfig from '@config/upload';
import IStorageProvider from '../models/IStorageProvider';

class DiskStorageProvider implements IStorageProvider {
  public async saveFile(file: string): Promise<string> {
    // tmp/ não vai para o Git, então a pasta pode não existir numa cópia nova
    await fs.promises.mkdir(uploadConfig.uploadsFolder, { recursive: true });

    const from = path.resolve(uploadConfig.tmpFolder, file);
    const to = path.resolve(uploadConfig.uploadsFolder, file);

    try {
      await fs.promises.rename(from, to);
    } catch (err) {
      // Pastas em discos diferentes (ex.: uploads num volume do Docker):
      // não dá para mover, então copia e apaga o temporário
      if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;

      await fs.promises.copyFile(from, to);
      await fs.promises.unlink(from);
    }

    return file;
  }

  public async deleteFile(file: string): Promise<void> {
    const filePath = path.resolve(uploadConfig.uploadsFolder, file);

    try {
      await fs.promises.stat(filePath);
    } catch {
      return;
    }

    await fs.promises.unlink(filePath);
  }
}
export default DiskStorageProvider;
