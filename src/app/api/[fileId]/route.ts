import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import * as crypto from 'crypto';

// Directory definitions
const UPLOADS_DIR = join(process.cwd(), 'uploads');

// Encryption key (should match upload route key)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nextshare-encryption-key-secure-very-long';

// Function to hash a password
function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + ENCRYPTION_KEY)
    .digest('hex');
}

// Function to decrypt file data
function decryptData(encryptedData: Buffer, password: string): Buffer {
  try {
    // Extract the IV from the beginning of the encrypted data
    const iv = encryptedData.subarray(0, 16);
    const actualEncryptedData = encryptedData.subarray(16);
    
    // Create the decipher
    const key = crypto.scryptSync(password, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // Decrypt the data
    return Buffer.concat([
      decipher.update(actualEncryptedData),
      decipher.final()
    ]);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt the file. Invalid password.');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Get the password from the request body
    const body = await request.json();
    const password = body.password;
    
    // Await params
    const resolvedParams = await Promise.resolve(params);
    const fileId = resolvedParams.fileId;
    
    // Check 8-digit ID
    if (!/^\d{8}$/.test(fileId)) {
      return NextResponse.json({ success: false, error: 'Invalid file ID' }, { status: 400 });
    }
    
    // Get meta data from file directory
    const fileDir = join(UPLOADS_DIR, fileId);
    const metaPath = join(fileDir, 'meta.json');
    
    if (!existsSync(metaPath)) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }
    
    const metaRaw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw);
    
    // Check if file has expired
    if (meta.expiresAt < Date.now()) {
      return NextResponse.json({ success: false, error: 'File has expired' }, { status: 410 });
    }
    
    // Check if file is encrypted and validate password
    if (meta.isEncrypted) {
      // Password is required
      if (!password) {
        return NextResponse.json({ 
          success: false, 
          error: 'Password required', 
          isEncrypted: true 
        }, { status: 401 });
      }
      
      // Validate password
      const hashedPassword = hashPassword(password);
      if (hashedPassword !== meta.passwordHash) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid password', 
          isEncrypted: true 
        }, { status: 401 });
      }
    }
    
    // If the validation passes, return success to indicate the password is correct
    return NextResponse.json({ 
      success: true, 
      fileName: meta.fileName, 
      isEncrypted: meta.isEncrypted 
    });
  } catch (error) {
    console.error('Password validation error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Await params
    const resolvedParams = await Promise.resolve(params);
    const fileId = resolvedParams.fileId;
    
    // Get password from URL if provided (not secure for production, only for demo)
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');
    
    // Check 8-digit ID
    if (!/^\d{8}$/.test(fileId)) {
      return new NextResponse('Invalid file ID', { status: 400 });
    }
    
    // Get meta data from file directory
    const fileDir = join(UPLOADS_DIR, fileId);
    const metaPath = join(fileDir, 'meta.json');
    
    if (!existsSync(metaPath)) {
      return new NextResponse('File not found', { status: 404 });
    }
    
    const metaRaw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw);
    
    // Check if file has expired
    if (meta.expiresAt < Date.now()) {
      return new NextResponse('File has expired', { status: 410 });
    }
    
    // Check if file is encrypted and if a password was provided
    if (meta.isEncrypted) {
      // Password is required for encrypted files
      if (!password) {
        return new NextResponse('Password required', { status: 401 });
      }
      
      // Validate password
      const hashedPassword = hashPassword(password);
      if (hashedPassword !== meta.passwordHash) {
        return new NextResponse('Invalid password', { status: 401 });
      }
    }
    
    // Create file path
    const finalPath = join(fileDir, meta.fileName);
    
    if (!existsSync(finalPath)) {
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Read the file
    const fileBuffer = await readFile(finalPath);
    let responseBuffer = fileBuffer;
    
    // Decrypt the file if it's encrypted
    if (meta.isEncrypted && password) {
      try {
        responseBuffer = decryptData(fileBuffer, password);
      } catch {
        return new NextResponse('Decryption failed', { status: 400 });
      }
    }
    
    // Get file stats (for Content-Length header)
    // Note: For encrypted files, this will be approximate since decrypted size may differ
    const fileStats = await stat(finalPath);
    
    // Set headers
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename=${encodeURIComponent(meta.fileName)}`);
    headers.set('Content-Type', 'application/octet-stream');
    
    // For non-encrypted files, use the file size. For encrypted files, use the buffer length
    headers.set('Content-Length', meta.isEncrypted ? responseBuffer.length.toString() : fileStats.size.toString());
    
    return new NextResponse(responseBuffer, {
      headers,
      status: 200,
    });
  } catch (error) {
    console.error('File download error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
} 