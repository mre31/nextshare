import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, rm, stat, readdir, appendFile } from 'fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { join, dirname } from 'path';
import * as crypto from 'crypto';

console.log("UPLOAD ROUTE HANDLER LOADED - CHUNKED V1");

// Export modunda API route'lar için gerekli
export const dynamic = 'force-dynamic';

// Metadata tip tanımı
interface FileMetadata {
  fileId: string;
  fileName: string;
  originalFileSize: number; // Orijinal toplam dosya boyutu
  totalChunks: number;
  receivedChunks: number;
  duration: number;
  timestamp: number;
  expiresAt: number;
  isEncrypted: boolean;
  passwordHash?: string;
  status?: 'pending' | 'completed' | 'failed' | 'assembling';
  finalPath?: string;
  uploadFileDir?: string; // UPLOADS_DIR içindeki dosya klasörü: uploads/{fileId}
  tempChunkDir?: string; // TEMP_DIR içindeki chunk klasörü: temp_uploads/{fileId}
  iv?: string;
}

// Temporary files directory
const TEMP_DIR = join(process.cwd(), 'temp_uploads');
const UPLOADS_DIR = join(process.cwd(), 'uploads');

// Encryption key (in a real app, this should be stored securely, not in the code)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nextshare-encryption-key-secure-very-long';

// Function to hash a password
function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + ENCRYPTION_KEY)
    .digest('hex');
}

// Function to clean up temporary files
async function cleanupTempDir(tempFileDir: string) {
  try {
    if (existsSync(tempFileDir)) {
      await rm(tempFileDir, { recursive: true, force: true });
      console.log(`Temporary directory cleaned: ${tempFileDir}`);
    }
    return true;
  } catch (error) {
    console.error('Error cleaning temporary directory:', error);
    return false;
  }
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
      readStream.close(); // Close the read stream after use
    }
    finalWriteStream.close(); // close() is synchronous for file streams after 'finish' or error
    // Wait for the 'finish' event to ensure writing is complete
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

async function encryptFile(filePath: string, password: string, originalFileName: string): Promise<{ encryptedFilePath: string, iv: string } | null> {
  const ivBuffer = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, 'salt', 32); 
  const cipher = crypto.createCipheriv('aes-256-cbc', key, ivBuffer);

  const encryptedFilePath = `${filePath}.enc`;
  const readStream = createReadStream(filePath);
  const writeStream = createWriteStream(encryptedFilePath);

  writeStream.write(ivBuffer); // Write IV at the beginning of the encrypted file

  try {
    await pipeline(readStream, cipher, writeStream);
    console.log(`File ${originalFileName} encrypted successfully to ${encryptedFilePath}`);
    return { encryptedFilePath, iv: ivBuffer.toString('hex') };
  } catch (error) {
    console.error(`Error encrypting file ${originalFileName}:`, error);
    if (existsSync(encryptedFilePath)) await rm(encryptedFilePath, { force: true });
    return null;
  }
}

// API handler
export async function POST(request: NextRequest) {
  console.log("CHUNK UPLOAD REQUEST RECEIVED AT /api/upload");
  const formData = await request.formData();

  const fileId = formData.get('fileId') as string;
  const fileName = formData.get('fileName') as string;
  const originalFileSizeStr = formData.get('fileSize') as string;
  const durationStr = formData.get('duration') as string;
  const isEncryptedStr = formData.get('isEncrypted') as string;
  const password = formData.get('password') as string | null; // Can be null
  const chunk = formData.get('chunk') as File | null;
  const chunkIndexStr = formData.get('chunkIndex') as string;
  const totalChunksStr = formData.get('totalChunks') as string;
  const clientChunkHash = formData.get('chunkHash') as string; // Get client-side chunk hash

  if (!fileId || !fileName || !originalFileSizeStr || !durationStr || !isEncryptedStr || !chunk || !chunkIndexStr || !totalChunksStr || !clientChunkHash) {
    return NextResponse.json({ success: false, error: 'Missing required form data fields (including chunkHash).' }, { status: 400 });
  }
  
  if (!/^\d{8}$/.test(fileId)) {
    return NextResponse.json({ success: false, error: 'Invalid file ID format (must be 8 digits)' }, { status: 400 });
  }

  const chunkIndex = parseInt(chunkIndexStr, 10);
  const totalChunks = parseInt(totalChunksStr, 10);
  const duration = parseInt(durationStr, 10);
  const isEncrypted = isEncryptedStr === 'true';
  const originalFileSize = parseInt(originalFileSizeStr, 10);

  if (isNaN(chunkIndex) || isNaN(totalChunks) || isNaN(duration) || isNaN(originalFileSize)) {
    return NextResponse.json({ success: false, error: 'Invalid numeric form data fields.' }, { status: 400 });
  }

  if (isEncrypted && (!password || password.length !== 4 || !/^\d{4}$/.test(password))) {
    return NextResponse.json({ success: false, error: 'Invalid password format for encrypted file - must be 4 digits.' }, { status: 400 });
  }

  const tempChunkDir = join(TEMP_DIR, fileId);
  const uploadFileDir = join(UPLOADS_DIR, fileId);
  const tempMetaPath = join(tempChunkDir, 'meta.json');

  try {
    await ensureDirExists(tempChunkDir);
    await ensureDirExists(uploadFileDir); // Ensure final upload dir also exists early

    const chunkPath = join(tempChunkDir, `chunk_${chunkIndex}`);
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    
    // Verify chunk integrity
    const serverCalculatedHash = crypto.createHash('sha256').update(chunkBuffer).digest('hex');
    if (serverCalculatedHash !== clientChunkHash) {
      console.error(`Chunk hash mismatch for ${fileId}, chunk ${chunkIndex}. Client: ${clientChunkHash}, Server: ${serverCalculatedHash}`);
      // Optionally, delete the potentially corrupted chunk if it was saved before hash check, though here we check before saving.
      return NextResponse.json({ success: false, error: 'Chunk data integrity check failed (hash mismatch).' }, { status: 400 });
    }
    
    await writeFile(chunkPath, chunkBuffer);
    console.log(`Chunk ${chunkIndex}/${totalChunks-1} for ${fileId} saved to ${chunkPath} (Hash verified)`);

    let meta: FileMetadata;
    if (existsSync(tempMetaPath)) {
      meta = JSON.parse(await readFile(tempMetaPath, 'utf-8')) as FileMetadata;
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
        finalPath: join(uploadFileDir, fileName) // Set finalPath early
      };
      if (isEncrypted && password) {
        meta.passwordHash = hashPassword(password);
      }
    }
    await writeFile(tempMetaPath, JSON.stringify(meta, null, 2));

    if (meta.receivedChunks === totalChunks) {
      console.log(`All ${totalChunks} chunks received for ${fileId}. Assembling...`);
      meta.status = 'assembling';
      await writeFile(tempMetaPath, JSON.stringify(meta, null, 2));

      const assemblySuccess = await assembleChunks(meta);
      if (!assemblySuccess) {
        meta.status = 'failed';
        await writeFile(tempMetaPath, JSON.stringify(meta, null, 2));
        // No cleanup of tempChunkDir here, allow for retries or manual cleanup later
        return NextResponse.json({ success: false, error: 'Failed to assemble chunks.' }, { status: 500 });
      }
      
      let finalFilePath = meta.finalPath!;
      let fileIv: string | undefined = undefined;

      if (isEncrypted && password) {
        console.log(`Encrypting assembled file ${finalFilePath} for ${fileId}`);
        const encryptionResult = await encryptFile(finalFilePath, password, fileName);
        if (encryptionResult) {
          await rm(finalFilePath, { force: true }); // Delete original unencrypted assembled file
          finalFilePath = encryptionResult.encryptedFilePath;
          fileIv = encryptionResult.iv;
          meta.fileName = `${fileName}.enc`; // Update filename to reflect encryption
          meta.finalPath = finalFilePath; 
          meta.iv = fileIv;
          console.log(`Encryption complete for ${fileId}. New path: ${finalFilePath}`);
        } else {
          meta.status = 'failed';
          await writeFile(tempMetaPath, JSON.stringify(meta, null, 2));
          await cleanupDirectory(tempChunkDir); // Cleanup temp chunks as encryption failed
          return NextResponse.json({ success: false, error: 'Failed to encrypt the assembled file.' }, { status: 500 });
        }
      }
      
      meta.status = 'completed';
      // Create final meta.json in the uploadFileDir
      const finalMetaPath = join(uploadFileDir, 'meta.json');
      await writeFile(finalMetaPath, JSON.stringify(meta, null, 2));
      
      await cleanupDirectory(tempChunkDir); // Clean up temp chunks after successful assembly and optional encryption

      console.log(`File ${fileId} processed successfully. Share link: ${fileId}`);
      return NextResponse.json({ 
        success: true, 
        message: 'File uploaded and processed successfully.',
        url: fileId // Client expects 'url' for shareLink
      });

    } else {
      console.log(`Chunk ${chunkIndex + 1}/${totalChunks} for ${fileId} received. Waiting for more chunks.`);
      return NextResponse.json({ 
        success: true, 
        message: `Chunk ${chunkIndex + 1}/${totalChunks} received.` 
      });
    }

  } catch (error: any) {
    console.error(`Error processing chunk for ${fileId}:`, error);
    // Update meta to failed if it exists
    if (existsSync(tempMetaPath)) {
        try {
            const metaContent = JSON.parse(await readFile(tempMetaPath, 'utf-8')) as FileMetadata;
            metaContent.status = 'failed';
            await writeFile(tempMetaPath, JSON.stringify(metaContent, null, 2));
        } catch (metaError) {
            console.error('Error updating temp metadata to failed on main error:', metaError);
        }
    }
    return NextResponse.json({ success: false, error: 'Server error processing chunk: ' + error.message }, { status: 500 });
  }
} 