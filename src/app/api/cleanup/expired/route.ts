import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Directory definitions
const UPLOADS_DIR = join(process.cwd(), 'uploads');
const TEMP_DIR = join(process.cwd(), 'temp_uploads');

/**
 * Temizleme API'si - süreleri dolmuş dosyaları ve geçici dosyaları siler
 */
export async function POST(request: NextRequest) {
  try {
    // Güvenlik kontrolü - bu API'nin yalnızca yerel ağdan veya şifreli olarak çağrılmasını sağlayabilirsiniz
    const { searchParams } = new URL(request.url);
    const authKey = searchParams.get('authKey');
    
    // Varsayılan bir güvenlik önlemi - gerçek uygulamada güvenli bir şekilde yapılandırılmalı
    if (authKey !== process.env.CLEANUP_AUTH_KEY) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    let cleanedFiles = 0;
    let cleanedDirs = 0;
    let failedCleanups = 0;
    
    // 1. Süresi dolmuş dosyaları temizle
    if (existsSync(UPLOADS_DIR)) {
      const folderIds = await readdir(UPLOADS_DIR);
      
      for (const folderId of folderIds) {
        const folderPath = join(UPLOADS_DIR, folderId);
        const metaPath = join(folderPath, 'meta.json');
        
        // Meta dosyası varsa kontrol et
        if (existsSync(metaPath)) {
          try {
            const metaRaw = await readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaRaw);
            
            // Süresi dolmuş mu kontrol et
            if (meta.expiresAt < Date.now()) {
              await rm(folderPath, { recursive: true, force: true });
              cleanedDirs++;
            }
          } catch (err) {
            console.error(`Error processing folder ${folderId}:`, err);
            failedCleanups++;
          }
        } else {
          // Meta dosyası yoksa temizle (bozuk veri)
          try {
            await rm(folderPath, { recursive: true, force: true });
            cleanedDirs++;
          } catch (err) {
            console.error(`Error cleaning folder without meta ${folderId}:`, err);
            failedCleanups++;
          }
        }
      }
    }
    
    // 2. Geçici dosyaları temizle (24 saatten eski)
    if (existsSync(TEMP_DIR)) {
      const tempFolders = await readdir(TEMP_DIR);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const tempFolder of tempFolders) {
        const tempFolderPath = join(TEMP_DIR, tempFolder);
        try {
          const stats = await readFile(`${tempFolderPath}/meta.json`, 'utf-8')
            .then(data => JSON.parse(data))
            .catch(() => ({ timestamp: 0 })); // Meta yoksa en eski zamanı kullan
          
          // 24 saatten eski temp dosyalarını temizle
          if (stats.timestamp < oneDayAgo) {
            await rm(tempFolderPath, { recursive: true, force: true });
            cleanedFiles++;
          }
        } catch (err) {
          console.error(`Error cleaning temp folder ${tempFolder}:`, err);
          failedCleanups++;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleanup complete: removed ${cleanedDirs} expired file folders and ${cleanedFiles} temp folders. ${failedCleanups} failures.`
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
} 