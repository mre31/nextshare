import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, appendFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import * as crypto from 'crypto';

// Export modunda API route'lar için gerekli
export const dynamic = 'force-dynamic';

// Metadata tip tanımı
interface FileMetadata {
  fileName: string;
  totalChunks: number;
  receivedChunks: number[];
  duration: number;
  timestamp: number;
  expiresAt: number;
  isEncrypted: boolean;
  passwordHash?: string;
  status?: string;
  finalPath?: string;
  fileDir?: string;
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

// Kullanılmayan fonksiyon - gerekirse tekrar etkinleştirin
/*
// Function to encrypt file data
function encryptData(data: Buffer, password: string): Buffer {
  // Create a cipher using the password and a random initialization vector
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  // Encrypt the data
  const encryptedData = Buffer.concat([
    iv,
    cipher.update(data),
    cipher.final()
  ]);
  
  return encryptedData;
}
*/

// Function to clean up temporary files
async function cleanupTempFiles(fileDir: string) {
  try {
    // Recursively delete temporary directory and contents
    await rm(fileDir, { recursive: true, force: true });
    console.log(`Temporary files cleaned: ${fileDir}`);
    return true;
  } catch (error) {
    console.error('Error cleaning temporary files:', error);
    return false;
  }
}

// API handler
export async function POST(request: NextRequest) {
  try {
    // Get form data
    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const fileIdRaw = formData.get('fileId');
    const fileNameRaw = formData.get('fileName');
    const chunkIndexRaw = formData.get('chunkIndex');
    const totalChunksRaw = formData.get('totalChunks');
    const durationRaw = formData.get('duration');
    const isEncryptedRaw = formData.get('isEncrypted');
    const passwordRaw = formData.get('password');
    
    // Validate and convert form values
    if (!chunk || !fileIdRaw || !fileNameRaw || !chunkIndexRaw || !totalChunksRaw || !durationRaw) {
      return NextResponse.json({ success: false, error: 'Missing chunk information' }, { status: 400 });
    }
    
    const fileId = String(fileIdRaw);
    const fileName = String(fileNameRaw);
    const chunkIndex = parseInt(String(chunkIndexRaw), 10);
    const totalChunks = parseInt(String(totalChunksRaw), 10);
    const duration = parseInt(String(durationRaw), 10);
    const isEncrypted = isEncryptedRaw ? String(isEncryptedRaw).toLowerCase() === 'true' : false;
    const password = passwordRaw ? String(passwordRaw) : '';
    
    // Validate password if encrypted
    if (isEncrypted && (password.length !== 4 || !/^\d{4}$/.test(password))) {
      return NextResponse.json({ success: false, error: 'Invalid password format - must be 4 digits' }, { status: 400 });
    }
    
    // Validate 8-digit ID
    if (!/^\d{8}$/.test(fileId)) {
      return NextResponse.json({ success: false, error: 'Invalid file ID format' }, { status: 400 });
    }
    
    // Check if directories exist and create them
    if (!existsSync(TEMP_DIR)) {
      await mkdir(TEMP_DIR, { recursive: true });
    }
    
    if (!existsSync(UPLOADS_DIR)) {
      await mkdir(UPLOADS_DIR, { recursive: true });
    }

    // Temporary file directory
    const fileDir = join(TEMP_DIR, fileId);
    if (!existsSync(fileDir)) {
      await mkdir(fileDir, { recursive: true });
    }
    
    // Save the file chunk temporarily
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkPath = join(fileDir, `chunk-${chunkIndex}`);
    await writeFile(chunkPath, chunkBuffer);
    
    // Save metadata
    const metaPath = join(fileDir, 'meta.json');
    const metaData: FileMetadata = {
      fileName,
      totalChunks,
      receivedChunks: [chunkIndex],
      duration,
      timestamp: Date.now(),
      expiresAt: Date.now() + (duration * 60 * 60 * 1000), // hours to milliseconds
      isEncrypted
    };
    
    // Add hashed password to metadata if file is encrypted
    if (isEncrypted && password) {
      metaData.passwordHash = hashPassword(password);
    }
    
    if (existsSync(metaPath)) {
      // Update existing metadata (add receivedChunks)
      const existingMetaRaw = await readFile(metaPath, 'utf-8');
      const existingMeta = JSON.parse(existingMetaRaw);
      
      if (!existingMeta.receivedChunks.includes(chunkIndex)) {
        existingMeta.receivedChunks.push(chunkIndex);
      }
      
      await writeFile(metaPath, JSON.stringify(existingMeta, null, 2));
    } else {
      // Create new metadata file
      await writeFile(metaPath, JSON.stringify(metaData, null, 2));
    }
    
    // If all chunks are received, merge the file
    const meta = existsSync(metaPath) 
      ? JSON.parse(await readFile(metaPath, 'utf-8'))
      : metaData;
    
    if (meta.receivedChunks.length === totalChunks) {
      // Check if all chunks are received
      if (meta.receivedChunks.sort((a: number, b: number) => a - b).every((chunk: number, i: number) => chunk === i)) {
        // Create folder for the file ID in uploads directory
        const uploadFileDir = join(UPLOADS_DIR, fileId);
        if (!existsSync(uploadFileDir)) {
          await mkdir(uploadFileDir, { recursive: true });
        }
        
        // Create final file (in folder by ID)
        const finalPath = join(uploadFileDir, fileName);
        
        // For encrypted files, process in smaller chunks to reduce memory usage
        if (isEncrypted && password) {
          // Prepare encryption
          const iv = crypto.randomBytes(16);
          const key = crypto.scryptSync(password, 'salt', 32);
          const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
          
          // Write IV at the beginning of the file
          await writeFile(finalPath, iv);
          
          // Process each chunk and append to the file
          for (let i = 0; i < totalChunks; i++) {
            const chunkPath = join(fileDir, `chunk-${i}`);
            const chunkData = await readFile(chunkPath);
            
            // Encrypt and append (for the last chunk, include cipher.final())
            if (i === totalChunks - 1) {
              await appendFile(finalPath, Buffer.concat([
                cipher.update(chunkData),
                cipher.final()
              ]));
            } else {
              await appendFile(finalPath, cipher.update(chunkData));
            }
          }
        } else {
          // For non-encrypted files, just merge chunks normally
          // Copy first chunk
          const firstChunkPath = join(fileDir, 'chunk-0');
          const firstChunkData = await readFile(firstChunkPath);
          await writeFile(finalPath, firstChunkData);
          
          // Add remaining chunks
          for (let i = 1; i < totalChunks; i++) {
            const chunkPath = join(fileDir, `chunk-${i}`);
            const chunkData = await readFile(chunkPath);
            await appendFile(finalPath, chunkData);
          }
        }
        
        // Update metadata - merge complete
        meta.status = 'completed';
        meta.finalPath = finalPath;
        meta.fileDir = uploadFileDir;
        
        // Copy metadata to directory and update temp metadata
        const uploadMetaPath = join(uploadFileDir, 'meta.json');
        await writeFile(uploadMetaPath, JSON.stringify(meta, null, 2));
        await writeFile(metaPath, JSON.stringify(meta, null, 2));
        
        // Check if file was created successfully
        if (existsSync(finalPath)) {
          // Clean up temporary files
          await cleanupTempFiles(fileDir);
        }
        
        // Return file ID directly as share link
        return NextResponse.json({ 
          success: true, 
          message: 'All chunks received and file merged',
          shareLink: fileId 
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded.` 
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
} 