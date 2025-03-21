import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';

// Export modunda API route'lar için gerekli
export const dynamic = 'force-dynamic';

// Directory definitions
const UPLOADS_DIR = join(process.cwd(), 'uploads');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Await params
    const resolvedParams = await Promise.resolve(params);
    const fileId = resolvedParams.fileId;
    
    // Get meta data from the new folder structure
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
    
    // Create file path
    const finalPath = join(fileDir, meta.fileName);
    
    if (!existsSync(finalPath)) {
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Get file stats for content-length
    const fileStats = await stat(finalPath);
    
    // Set headers
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename=${encodeURIComponent(meta.fileName)}`);
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Length', fileStats.size.toString());
    
    // Create a read stream instead of loading the entire file into memory
    const fileStream = createReadStream(finalPath);
    
    // Use web streams API to stream the file instead of loading it all into memory
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        
        fileStream.on('end', () => {
          controller.close();
        });
        
        fileStream.on('error', (error) => {
          console.error('Stream error:', error);
          controller.error(error);
        });
      },
    });
    
    return new NextResponse(stream, {
      headers,
      status: 200,
    });
  } catch (error) {
    console.error('File download error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
} 