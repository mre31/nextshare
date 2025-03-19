/**
 * File chunking utility functions
 */

// Calculate file size in MB
export function getFileSizeInMB(file: File): number {
  return file.size / (1024 * 1024);
}

// Split file into chunks of specified size
export function splitFileIntoChunks(file: File, maxChunkSizeMB: number): Blob[] {
  const maxChunkSize = maxChunkSizeMB * 1024 * 1024; // MB to bytes
  const fileSize = file.size;
  const chunks = [];
  let start = 0;
  
  while (start < fileSize) {
    let end = start + maxChunkSize;
    
    // Adjust for last chunk to not exceed file size
    if (end > fileSize) {
      end = fileSize;
    }
    
    // Get chunk from file
    const chunk = file.slice(start, end);
    chunks.push(chunk);
    
    // Update positions for next chunk
    start = end;
  }
  
  return chunks;
}

// Generate a unique 8-digit file ID
export function generateUniqueFileId(): string {
  // Generate 7 random digits
  let id = '';
  for (let i = 0; i < 7; i++) {
    id += Math.floor(Math.random() * 10);
  }
  
  // Add checksum as 8th digit
  const sum = id.split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);
  const checksum = sum % 10;
  
  return id + checksum;
}

// Create chunk metadata for transfer
export type ChunkMetadata = {
  fileName: string;
  fileSize: number;
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
};

// Dosya parçası için gerekli meta bilgileri oluştur
export const createChunkMetadata = (
  fileId: string, 
  fileName: string,
  chunkIndex: number, 
  totalChunks: number,
  duration: number
) => {
  return {
    fileId,
    fileName,
    chunkIndex,
    totalChunks,
    duration,
    timestamp: Date.now()
  };
}; 