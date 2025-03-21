import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { statSync } from 'fs';

// Export modunda API route'lar için gerekli
export const dynamic = 'force-dynamic';

// Directory definitions
const UPLOADS_DIR = join(process.cwd(), 'uploads');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Önce params'i await etmemiz gerekiyor
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
      return NextResponse.json({ 
        success: true, 
        expired: true,
        fileName: meta.fileName,
        isEncrypted: meta.isEncrypted || false
      });
    }
    
    // Calculate file size
    let fileSize = "Unknown";
    try {
      const filePath = join(fileDir, meta.fileName);
      if (existsSync(filePath)) {
        const stats = existsSync(filePath) ? statSync(filePath) : null;
        if (stats) {
          const bytes = stats.size;
          if (bytes < 1024) {
            fileSize = bytes + " B";
          } else if (bytes < 1024 * 1024) {
            fileSize = (bytes / 1024).toFixed(2) + " KB";
          } else if (bytes < 1024 * 1024 * 1024) {
            fileSize = (bytes / (1024 * 1024)).toFixed(2) + " MB";
          } else {
            fileSize = (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
          }
        }
      }
    } catch (error) {
      console.error("Error calculating file size:", error);
    }
    
    // Return file information, but not the password hash
    return NextResponse.json({
      success: true,
      fileName: meta.fileName,
      fileSize,
      expiresAt: meta.expiresAt,
      status: meta.status || 'pending',
      receivedChunks: meta.receivedChunks || [],
      totalChunks: meta.totalChunks || 0,
      isEncrypted: meta.isEncrypted || false,
      expired: false
    });
  } catch (error) {
    console.error('Error getting file information:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
} 