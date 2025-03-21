import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Export modunda API route'lar için gerekli
export const dynamic = 'force-dynamic';

// Uploads dizini
const UPLOADS_DIR = join(process.cwd(), 'uploads');

// Temizleyici token (güvenlik için)
const CLEANUP_TOKEN = process.env.CLEANUP_TOKEN || 'nextshare-cleanup-token';

// Süresi dolmuş dosyaları temizleme
async function cleanupExpiredFiles() {
  try {
    console.log('Süresi dolmuş dosyaları kontrol etme başladı...');
    // Uploads dizini yoksa çık
    if (!existsSync(UPLOADS_DIR)) {
      console.log('Uploads dizini bulunamadı');
      return {
        success: false,
        error: 'Uploads dizini bulunamadı'
      };
    }

    // Tüm dosya klasörlerini al
    const fileDirs = await readdir(UPLOADS_DIR);
    let removedCount = 0;
    let checkedCount = 0;

    // Her klasörü kontrol et
    for (const fileId of fileDirs) {
      const fileDir = join(UPLOADS_DIR, fileId);
      const metaPath = join(fileDir, 'meta.json');
      
      // Meta dosyası yoksa sonraki klasöre geç
      if (!existsSync(metaPath)) {
        continue;
      }
      
      checkedCount++;
      
      try {
        // Meta dosyasını oku
        const metaRaw = await readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaRaw);
        
        // Dosyanın süresi dolmuş mu kontrol et
        if (meta.expiresAt && meta.expiresAt < Date.now()) {
          console.log(`Süresi dolmuş dosya bulundu: ${fileId} (${meta.fileName})`);
          
          // Klasörü ve içeriğini sil
          await rm(fileDir, { recursive: true, force: true });
          removedCount++;
          
          console.log(`Dosya silindi: ${fileId}`);
        }
      } catch (error) {
        console.error(`Dosya işlenirken hata oluştu (${fileId}):`, error);
      }
    }
    
    console.log(`Temizleme tamamlandı. Kontrol: ${checkedCount}, Silinen: ${removedCount}`);
    
    return {
      success: true,
      checkedCount,
      removedCount
    };
  } catch (error) {
    console.error('Temizleme sırasında hata oluştu:', error);
    return {
      success: false,
      error: 'Temizleme sırasında hata oluştu'
    };
  }
}

// API Handler
export async function GET(request: NextRequest) {
  try {
    // Token kontrolü
    const token = request.nextUrl.searchParams.get('token');
    
    if (!token || token !== CLEANUP_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz token' },
        { status: 401 }
      );
    }
    
    // Temizleme işlemini başlat
    const result = await cleanupExpiredFiles();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Temizleme API hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// POST metodunu da destekle
export async function POST(request: NextRequest) {
  return GET(request); // GET metodunu çağır
} 