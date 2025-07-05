import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, rm } from 'fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import * as fs from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';
import { lock, unlock, check } from 'proper-lockfile';

console.log("UPLOAD ROUTE HANDLER LOADED - CHUNKED V1 - ATOMIC META UPDATE");

// Export modunda API route'lar için gerekli
export const dynamic = 'force-dynamic';

// Metadata tip tanımı
interface FileMetadata {
  fileId: string;
  fileName: string; // Artık .enc içermeyecek
  originalFileSize: number;
  totalChunks: number;
  receivedChunks: number;
  duration: number;
  timestamp: number;
  expiresAt: number;
  isEncrypted: boolean; // Parola koruması var mı?
  passwordHash?: string; // Parola koruması varsa hash'i
  status?: 'pending' | 'completed' | 'failed' | 'assembling';
  finalPath?: string;
  uploadFileDir?: string;
  tempChunkDir?: string;
  // iv?: string; // IV artık kullanılmıyor
}

// Temporary files directory
const TEMP_DIR = join(process.cwd(), 'temp_uploads');
const UPLOADS_DIR = join(process.cwd(), 'uploads');

// Encryption key (sadece parola hash için kullanılacak)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nextshare-encryption-key-secure-very-long';

// Function to hash a password
function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + ENCRYPTION_KEY)
    .digest('hex');
}

async function ensureDirExists(dirPath: string) {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

async function cleanupDirectory(dirPath: string) {
  try {
    if (existsSync(dirPath)) {
      await rm(dirPath, { recursive: true, force: true });
      console.log(`Directory cleaned: ${dirPath}`);
    }
  } catch (error) {
    console.error(`Error cleaning directory ${dirPath}:`, error);
  }
}

async function assembleChunks(meta: FileMetadata): Promise<boolean> {
  if (!meta.tempChunkDir || !meta.uploadFileDir || !meta.fileName || !meta.finalPath) {
    console.error("Missing paths in metadata for assembly:", meta);
    return false;
  }
  console.log(`Assembling chunks for ${meta.fileId} into ${meta.finalPath}`);
  
  await ensureDirExists(meta.uploadFileDir);
  const finalWriteStream = createWriteStream(meta.finalPath);

  try {
    for (let i = 0; i < meta.totalChunks; i++) {
      const chunkPath = join(meta.tempChunkDir, `chunk_${i}`);
      if (!existsSync(chunkPath)) {
        console.error(`Chunk ${i} not found for file ${meta.fileId}`);
        finalWriteStream.close();
        await rm(meta.finalPath, { force: true }).catch(e => console.error("Error deleting incomplete assembly:", e));
        return false;
      }
      const readStream = createReadStream(chunkPath);
      for await (const chunkData of readStream) {
        finalWriteStream.write(chunkData);
      }
      readStream.close();
    }
    finalWriteStream.close();
    await new Promise<void>((resolve, reject) => {
      finalWriteStream.on('finish', () => resolve());
      finalWriteStream.on('error', (err: Error) => reject(err));
    });
    console.log(`File ${meta.fileId} assembled successfully.`);
    return true;
  } catch (error) {
    console.error(`Error assembling chunks for ${meta.fileId}:`, error);
    finalWriteStream.close();
    await rm(meta.finalPath, { force: true }).catch(e => console.error("Error deleting incomplete assembly on error:", e));
    return false;
  }
}

// API handler
export async function POST(request: NextRequest) {
  console.log("CHUNK UPLOAD REQUEST RECEIVED AT /api/upload - ATOMIC META UPDATE");
  const formData = await request.formData();

  const fileId = formData.get('fileId') as string;
  const fileName = formData.get('fileName') as string; // Bu orijinal dosya adı olacak
  const originalFileSizeStr = formData.get('fileSize') as string;
  const durationStr = formData.get('duration') as string;
  const isEncryptedStr = formData.get('isEncrypted') as string; // Bu, parola koruması olup olmadığını belirtir
  const password = formData.get('password') as string | null;
  const chunk = formData.get('chunk') as File | null;
  const chunkIndexStr = formData.get('chunkIndex') as string;
  const totalChunksStr = formData.get('totalChunks') as string;
  const clientChunkHash = formData.get('chunkHash') as string;

  if (!fileId || !fileName || !originalFileSizeStr || !durationStr || !isEncryptedStr || !chunk || !chunkIndexStr || !totalChunksStr || !clientChunkHash) {
    return NextResponse.json({ success: false, error: 'Missing required form data fields (including chunkHash).' }, { status: 400 });
  }
    
  if (!/^\d{8}$/.test(fileId)) {
    return NextResponse.json({ success: false, error: 'Invalid file ID format (must be 8 digits)' }, { status: 400 });
  }
    
  const chunkIndex = parseInt(chunkIndexStr, 10);
  const totalChunks = parseInt(totalChunksStr, 10);
  const duration = parseInt(durationStr, 10);
  const isEncrypted = isEncryptedStr === 'true'; // Parola koruması
  const originalFileSize = parseInt(originalFileSizeStr, 10);

  if (isNaN(chunkIndex) || isNaN(totalChunks) || isNaN(duration) || isNaN(originalFileSize)) {
    return NextResponse.json({ success: false, error: 'Invalid numeric form data fields.' }, { status: 400 });
  }
    
  if (isEncrypted && (!password || password.length !== 4 || !/^\d{4}$/.test(password))) {
    return NextResponse.json({ success: false, error: 'Invalid password format for protected file - must be 4 digits.' }, { status: 400 });
  }

  const tempChunkDir = join(TEMP_DIR, fileId);
  const uploadFileDir = join(UPLOADS_DIR, fileId);
  const lockPath = join(tempChunkDir, 'meta.json.lock');

  try {
    await ensureDirExists(tempChunkDir);
    await ensureDirExists(uploadFileDir);

    // Ek loglama: Dizinin varlığını kontrol et
    console.log(`[Upload API Debug] tempChunkDir: ${tempChunkDir}, Exists: ${existsSync(tempChunkDir)}`);
    console.log(`[Upload API Debug] uploadFileDir: ${uploadFileDir}, Exists: ${existsSync(uploadFileDir)}`);

    const chunkPath = join(tempChunkDir, `chunk_${chunkIndex}`);
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    
    const serverCalculatedHash = crypto.createHash('sha256').update(chunkBuffer).digest('hex');
    if (serverCalculatedHash !== clientChunkHash) {
      console.error(`Chunk hash mismatch for ${fileId}, chunk ${chunkIndex}. Client: ${clientChunkHash}, Server: ${serverCalculatedHash}`);
      return NextResponse.json({ success: false, error: 'Chunk data integrity check failed (hash mismatch).' }, { status: 400 });
    }
    
    await writeFile(chunkPath, chunkBuffer);
    console.log(`Chunk ${chunkIndex}/${totalChunks - 1} for ${fileId} saved to ${chunkPath}`);

    // Ek loglama: Kilit almadan hemen önce dizinin varlığını tekrar kontrol et
    console.log(`[Upload API Debug] Before lock attempt - tempChunkDir: ${tempChunkDir}, Exists: ${existsSync(tempChunkDir)}`);
    console.log(`Attempting to acquire lock for ${lockPath}.`);

    // Test amaçlı: Kilit dosyasını manuel oluşturmayı dene
    try {
      if (!existsSync(lockPath)) {
        fs.closeSync(fs.openSync(lockPath, 'w')); // Boş bir .lock dosyası oluştur
        console.log(`[Upload API Debug] Manually created empty lock file: ${lockPath}`);
      }
    } catch (e: unknown) {
      let errorMessage = 'Unknown error while manually creating lock file';
      if (e instanceof Error) {
        errorMessage = e.message;
      } else if (typeof e === 'string') {
        errorMessage = e;
      }
      console.error(`[Upload API Debug] Error manually creating lock file ${lockPath}: ${errorMessage}`);
      // Bu hata kritik olabilir, devam etmeyebiliriz veya loglayıp devam edebiliriz.
    }

    const lockOptions = {
      stale: 20000,
      retries: { retries: 8, factor: 2, minTimeout: 1000, maxTimeout: 6000 },
      fs: fs
    }; 
    await lock(lockPath, lockOptions);
    console.log(`Lock acquired for ${lockPath}`);

    let meta: FileMetadata | undefined = undefined;
    const tempMetaFileConcretePath = join(tempChunkDir, 'meta.json');
    try {
      if (existsSync(tempMetaFileConcretePath)) {
        meta = JSON.parse(await readFile(tempMetaFileConcretePath, 'utf-8')) as FileMetadata;
        meta.receivedChunks = (meta.receivedChunks || 0) + 1;
      } else {
        meta = {
          fileId,
          fileName,
          originalFileSize,
          totalChunks,
          receivedChunks: 1,
          duration,
          timestamp: Date.now(),
          expiresAt: Date.now() + (duration * 60 * 60 * 1000),
          isEncrypted,
          status: 'pending',
          tempChunkDir,
          uploadFileDir,
          finalPath: join(uploadFileDir, fileName)
        };
        if (isEncrypted && password) {
          meta.passwordHash = hashPassword(password);
        }
      }
      await writeFile(tempMetaFileConcretePath, JSON.stringify(meta, null, 2));
      
      if (meta.receivedChunks === totalChunks) {
        console.log(`All ${totalChunks} chunks received for ${fileId}. Assembling...`);
        meta.status = 'assembling';
        await writeFile(tempMetaFileConcretePath, JSON.stringify(meta, null, 2));

        const assemblySuccess = await assembleChunks(meta);
        if (!assemblySuccess) {
          meta.status = 'failed';
          await writeFile(tempMetaFileConcretePath, JSON.stringify(meta, null, 2));
          return NextResponse.json({ success: false, error: 'Failed to assemble chunks.' }, { status: 500 });
        }
        
        meta.status = 'completed';
        const finalMetaPath = join(uploadFileDir, 'meta.json');
        await writeFile(finalMetaPath, JSON.stringify(meta, null, 2));
        
        console.log(`File ${fileId} processed successfully (atomic). Share link: ${fileId}/${encodeURIComponent(meta.fileName)}`);
        return NextResponse.json({ success: true, message: 'File uploaded and processed successfully.', url: `${fileId}/${encodeURIComponent(meta.fileName)}` });

      } else {
        console.log(`Chunk ${chunkIndex + 1}/${totalChunks} for ${fileId} received. Waiting for more chunks.`);
        return NextResponse.json({ 
          success: true, 
          message: `Chunk ${chunkIndex + 1}/${totalChunks} received.` 
        });
      }

    } finally {
      if (await check(lockPath)) {
         await unlock(lockPath);
         console.log(`Lock released for ${lockPath}`);
         if (meta && meta.status === 'completed') {
            if (existsSync(tempMetaFileConcretePath)) {
                console.log(`Attempting to remove temporary meta file: ${tempMetaFileConcretePath}`);
                await rm(tempMetaFileConcretePath, { force: true }).catch(err => console.error(`Error removing temp meta file: ${err.message}`));
            }
            console.log(`Attempting to cleanup tempChunkDir after completion: ${tempChunkDir}`);
            await cleanupDirectory(tempChunkDir).catch(err => console.error(`Error cleaning up tempChunkDir post-completion: ${err.message}`));
         }
      } else {
         console.log(`Lock for ${lockPath} was not held or already released.`);
      }
    }

  } catch (error: unknown) {
    console.error(`Error processing chunk for ${fileId}:`, error);
    
    let AImessage = 'Server error processing chunk.';
    let retryClient = false;
    let statusCode = 500;

    if (typeof error === 'object' && error !== null && 'code' in error) {
      const nodeError = error as { code: string; message?: string }; 
      
      if (nodeError.code === 'ELOCKED') { 
        AImessage = 'Server is busy processing this file, please try again shortly.';
        retryClient = true;
        statusCode = 429; 
      } else if (nodeError.code === 'EROFS' || nodeError.code === 'ENOSPC') { 
        AImessage = 'Server storage error, please contact administrator.';
      } else if (nodeError.code === 'ENOENT') {
        AImessage = `File system error (ENOENT): ${nodeError.message}. Check if paths are correct and directories exist.`;
      } else if (nodeError.message) { 
        AImessage = nodeError.message;
      } else { 
        AImessage = `Server error with code: ${nodeError.code}`;
      }
    } else if (error instanceof Error) { 
      AImessage = error.message;
    } 

    return NextResponse.json({ success: false, error: `Server error: ${AImessage}`, retry: retryClient }, { status: statusCode });
  }
} 