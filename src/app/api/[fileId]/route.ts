import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync, createReadStream } from 'fs';
import { readFile, stat } from 'fs/promises';
import * as crypto from 'crypto';

// Export modunda API route'lar için gerekli
export const dynamic = 'force-dynamic';

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

// POST metodu parola kontrolü için kalabilir, belki bir indirme sayfasında parola girmek için kullanılır.
export async function POST(request: NextRequest, props: { params: Promise<{ fileId: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    const password = body.password;
    const resolvedParams = await Promise.resolve(params);
    const fileId = resolvedParams.fileId;

    if (!/^\d{8}$/.test(fileId)) {
      return NextResponse.json({ success: false, error: 'Invalid file ID' }, { status: 400 });
    }
    
    const fileDir = join(UPLOADS_DIR, fileId);
    const metaPath = join(fileDir, 'meta.json');
    
    if (!existsSync(metaPath)) {
      return NextResponse.json({ success: false, error: 'File metadata not found' }, { status: 404 });
    }
    
    const metaRaw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw);
    
    if (meta.expiresAt < Date.now()) {
      return NextResponse.json({ success: false, error: 'File has expired' }, { status: 410 });
    }
    
    if (meta.isEncrypted) { // isEncrypted artık parola koruması anlamına geliyor
      if (!password) {
        return NextResponse.json({ success: false, error: 'Password required', isEncrypted: true }, { status: 401 });
      }
      const hashedPassword = hashPassword(password);
      if (hashedPassword !== meta.passwordHash) {
        return NextResponse.json({ success: false, error: 'Invalid password', isEncrypted: true }, { status: 401 });
      }
    }
    // Parola doğruysa veya dosya parola korumalı değilse, indirmeye izin ver
    return NextResponse.json({ 
      success: true, 
      fileName: meta.fileName, // Orijinal dosya adı
      // isEncrypted: meta.isEncrypted // Bu bilgi GET isteğinde daha anlamlı olabilir
    });
  } catch (error) {
    console.error('Password validation error (POST):', error);
    return NextResponse.json({ success: false, error: 'Server error during password validation' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ fileId: string }> }) {
  const params = await props.params;
  try {
    const resolvedParams = await Promise.resolve(params);
    const fileId = resolvedParams.fileId;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password'); // Parola URL'den alınır
    
    if (!/^\d{8}$/.test(fileId)) {
      return new NextResponse('Invalid file ID', { status: 400 });
    }
    
    const fileDir = join(UPLOADS_DIR, fileId);
    const metaPath = join(fileDir, 'meta.json');
    
    if (!existsSync(metaPath)) {
      return new NextResponse('File metadata not found', { status: 404 });
    }
    
    const metaRaw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw);
    
    if (meta.expiresAt < Date.now()) {
      return new NextResponse('File has expired', { status: 410 });
    }
    
    // Parola koruması kontrolü
    if (meta.isEncrypted) { // isEncrypted artık "parola korumalı" demek
      if (!password) {
        // Tarayıcıda bir parola giriş ekranı göstermek yerine direkt hata veriyoruz.
        // Alternatif olarak, parola soran bir HTML sayfası döndürülebilir.
        return new NextResponse('Password required for this file. Please provide it as a query parameter (e.g., ?password=XXXX)', { status: 401 });
      }
      const hashedPassword = hashPassword(password);
      if (hashedPassword !== meta.passwordHash) {
        return new NextResponse('Invalid password', { status: 401 });
      }
      // Parola doğru, dosya indirme devam edecek.
    }
    
    // Dosya yolu (artık .enc uzantısı yok, meta.fileName orijinal adı içeriyor)
    const finalPath = join(fileDir, meta.fileName);
    
    if (!existsSync(finalPath)) {
      console.error(`File not found at physical path: ${finalPath} for fileId: ${fileId}`);
      return new NextResponse('File not found on server', { status: 404 });
    }

    const fileStats = await stat(finalPath);
    const headers = new Headers();
    // downloadFileName her zaman meta.fileName olacak çünkü içerik şifrelenmiyor ve dosya adı değişmiyor.
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.fileName)}"`);
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Length', fileStats.size.toString()); // Her zaman dosyanın gerçek boyutu

    // Dosyayı direkt stream et, şifre çözme yok.
    const fileStream = createReadStream(finalPath);

    fileStream.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ABORT_ERR') {
        // İstemci bağlantıyı kapattığında (indirme tamamlandı veya iptal edildi)
        // bu hata oluşabilir. Genellikle kritik bir sorun değildir.
        console.log(`File stream for ${fileId} aborted, likely by client (code: ${err.code}): ${err.message}`);
      } else {
        // Diğer stream hataları daha ciddi olabilir.
        console.error(`Error reading file stream for ${fileId} (download):`, err);
      }
      // Bu aşamada başlıklar gönderilmiş olabilir, bu yüzden istemciye 
      // ayrıca bir hata yanıtı göndermek genellikle mümkün veya anlamlı değildir.
    });
      
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new NextResponse(fileStream as any, { 
      headers,
      status: 200,
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('File download error (GET):', error);
    let message = 'Server error during file download.';
    // ERR_FS_FILE_TOO_LARGE hatası stream ile çözülmüş olmalı, ama yine de kontrol ekleyebiliriz.
    if (error.code === 'ERR_FS_FILE_TOO_LARGE') {
        message = 'The file is unexpectedly large.';
    }
    return new NextResponse(message, { status: 500 });
  }
} 