// File cleanup scheduler
import { exec } from 'child_process';

let cleanupInterval: NodeJS.Timeout | null = null;
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

// Start the cleanup scheduler
export function startCleanupScheduler() {
  if (cleanupInterval) return; // Already running
  
  console.log('File cleanup scheduler started');
  
  // Run immediately on start
  runCleanupTask();
  
  // Schedule regular runs
  cleanupInterval = setInterval(runCleanupTask, CLEANUP_INTERVAL);
  
  return true;
}

// Stop the cleanup scheduler
export function stopCleanupScheduler() {
  if (!cleanupInterval) return; // Not running
  
  clearInterval(cleanupInterval);
  cleanupInterval = null;
  
  console.log('File cleanup scheduler stopped');
  
  return true;
}

// Run cleanup API to remove expired files
function runCleanupTask() {
  // Sabit host ve token değerleri
  const host = 'http://localhost:5000';
  const cleanupToken = 'nextshare-cleanup-token';
  
  // Build the URL with token
  const cleanupUrl = `${host}/api/cleanup?token=${cleanupToken}`;
  
  console.log(`Running cleanup task at: ${cleanupUrl}`);
  
  // Use curl to call the cleanup API
  exec(`curl -s -X POST "${cleanupUrl}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('Error running cleanup task:', error);
      return;
    }
    
    if (stderr) {
      console.error('Cleanup stderr:', stderr);
      return;
    }
    
    try {
      // Boş yanıt kontrolü ekle
      if (!stdout || stdout.trim() === '') {
        console.log('Cleanup task returned empty response');
        return;
      }
      
      const result = JSON.parse(stdout);
      console.log('Cleanup task result:', result);
    } catch (error) {
      console.error('Error parsing cleanup task result:', error);
    }
  });
} 