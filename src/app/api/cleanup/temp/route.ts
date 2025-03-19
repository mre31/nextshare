import { NextRequest, NextResponse } from 'next/server';
import { rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Temporary files directory
const TEMP_DIR = join(process.cwd(), 'temp_uploads');

// API handler
export async function DELETE(request: NextRequest) {
  try {
    // Get fileId parameter from URL
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    
    // Return error if fileId parameter is missing
    if (!fileId) {
      return NextResponse.json({ success: false, error: 'File ID parameter is required' }, { status: 400 });
    }
    
    // Validate 8-digit ID
    if (!/^\d{8}$/.test(fileId)) {
      return NextResponse.json({ success: false, error: 'Invalid file ID format' }, { status: 400 });
    }
    
    // Create temporary file directory
    const fileDir = join(TEMP_DIR, fileId);
    
    // If directory doesn't exist, return success (already cleaned)
    if (!existsSync(fileDir)) {
      return NextResponse.json({ 
        success: true, 
        message: 'Temporary file already deleted' 
      });
    }
    
    // Delete temporary files recursively
    await rm(fileDir, { recursive: true, force: true });
    
    console.log(`Temporary files cleaned: ${fileId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Temporary files successfully cleaned'
    });
  } catch (error) {
    console.error('Error cleaning temporary files:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
} 