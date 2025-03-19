import { join } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Klasör tanımlamaları
const UPLOADS_DIR = join(process.cwd(), 'uploads');

interface SharePageProps {
  params: Promise<{
    fileId: string;
  }>;
}

// Dosya bilgilerini alma
async function getFileInfo(fileId: string) {
  try {
    // Artık meta veriyi dosya klasöründen alacağız
    const fileDir = join(UPLOADS_DIR, fileId);
    const metaPath = join(fileDir, 'meta.json');
    
    if (!existsSync(metaPath)) {
      return null;
    }
    
    const metaRaw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw);
    
    // Dosya süresi dolmuş mu kontrol et
    if (meta.expiresAt < Date.now()) {
      return {
        ...meta,
        expired: true
      };
    }
    
    // Kalan süreyi hesapla (saat cinsinden)
    const remainingTimeMs = meta.expiresAt - Date.now();
    const remainingHours = Math.max(0, Math.ceil(remainingTimeMs / (1000 * 60 * 60)));
    
    return {
      ...meta,
      expired: false,
      remainingHours
    };
  } catch (error) {
    console.error('Dosya bilgisi alınamadı:', error);
    return null;
  }
}

export default async function SharePage({ params }: SharePageProps) {
  // params'ı await edelim
  const resolvedParams = await Promise.resolve(params);
  const fileId = resolvedParams.fileId;
  const fileInfo = await getFileInfo(fileId);
  
  if (!fileInfo) {
    // Dosya bulunamadı
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
        <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
          <h2 className="text-red-400 text-2xl font-bold text-center mb-4">Dosya Bulunamadı</h2>
          <div className="text-center text-zinc-300 mb-6">
            <p>Aradığınız dosya bulunamadı veya paylaşım süresi sona ermiş olabilir.</p>
          </div>
          <div className="flex justify-center">
            <Link href="/">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Ana Sayfaya Dön</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  if (fileInfo.expired) {
    // Dosya süresi dolmuş
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
        <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
          <h2 className="text-yellow-400 text-2xl font-bold text-center mb-4">Paylaşım Süresi Dolmuş</h2>
          <div className="text-center text-zinc-300 mb-6">
            <p>Bu dosya için paylaşım süresi sona ermiştir.</p>
          </div>
          <div className="flex justify-center">
            <Link href="/">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Ana Sayfaya Dön</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  if (fileInfo.status !== 'completed') {
    // Dosya hala işleniyor
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
        <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
          <h2 className="text-blue-400 text-2xl font-bold text-center mb-4">Dosya İşleniyor</h2>
          <div className="text-center text-zinc-300 mb-6">
            <p>Dosya hala işleniyor. Lütfen daha sonra tekrar deneyin.</p>
            <p className="mt-2 text-sm text-zinc-500">
              İşlenen parçalar: {fileInfo.receivedChunks.length}/{fileInfo.totalChunks}
            </p>
          </div>
          <div className="flex justify-center">
            <Link href="/">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Ana Sayfaya Dön</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // Dosya indirme linki
  const downloadLink = `/api/download/${fileId}`;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
      <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
        <h2 className="text-green-400 text-2xl font-bold text-center mb-4">Dosya İndirmeye Hazır</h2>
        <div className="text-center space-y-4 mb-6">
          <p className="font-medium text-white">{fileInfo.fileName}</p>
          <p className="text-sm text-zinc-400">
            Kalan süre: {fileInfo.remainingHours} saat
          </p>
        </div>
        <div className="flex justify-center">
          <a href={downloadLink} download={fileInfo.fileName}>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              Dosyayı İndir
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
} 