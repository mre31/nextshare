import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { statSync, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import FilePageClient from './FilePageClient'; // İstemci bileşenini import et

// Arayüzler
interface FilePageProps {
  params: Promise<{
    fileId: string;
  }>;
}

interface FileInfo {
  fileName: string;
  fileSize: string;
  expiresAt: number;
  isEncrypted: boolean;
  expired: boolean;
  status: string;
  receivedChunks?: string[];
  totalChunks?: number;
}

// Sunucu tarafı veri getirme fonksiyonu
async function getFileInfo(fileId: string): Promise<FileInfo | null> {
  const UPLOADS_DIR = join(process.cwd(), 'uploads');
  
  if (!/^\d{8}$/.test(fileId)) {
    return null;
  }
  
  const fileDir = join(UPLOADS_DIR, fileId);
  const metaPath = join(fileDir, 'meta.json');
  
  if (!existsSync(metaPath)) {
    return null;
  }
  
  try {
    const metaRaw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw);
    
    const expired = meta.expiresAt < Date.now();
    
    let fileSize = "Unknown";
    if (meta.status === 'completed') {
      try {
        const filePath = join(fileDir, meta.fileName);
        if (existsSync(filePath)) {
          const stats = statSync(filePath);
          const bytes = stats.size;
          if (bytes < 1024) fileSize = `${bytes} B`;
          else if (bytes < 1024 * 1024) fileSize = `${(bytes / 1024).toFixed(2)} KB`;
          else if (bytes < 1024 * 1024 * 1024) fileSize = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
          else fileSize = `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        }
      } catch (error) {
        console.error("Error calculating file size:", error);
      }
    }

    return {
      fileName: meta.fileName,
      fileSize,
      expiresAt: meta.expiresAt,
      isEncrypted: meta.isEncrypted || false,
      expired,
      status: meta.status || 'pending',
      receivedChunks: meta.receivedChunks,
      totalChunks: meta.totalChunks,
    };
  } catch (error) {
    console.error('Error reading file metadata:', error);
    return null;
  }
}

// Dinamik metadata oluşturma fonksiyonu
export async function generateMetadata(props: FilePageProps): Promise<Metadata> {
  const params = await props.params;
  const fileInfo = await getFileInfo(params.fileId);

  if (!fileInfo || fileInfo.expired || fileInfo.status !== 'completed') {
    return {
      title: 'File Not Found or Expired',
      description: 'The requested file is not available.',
    };
  }

  const expirationDate = new Date(fileInfo.expiresAt).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return {
    title: `Download ${fileInfo.fileName}`,
    description: `Download the file "${fileInfo.fileName}" (${fileInfo.fileSize}). This link is valid until ${expirationDate}.`,
    openGraph: {
      title: `Download ${fileInfo.fileName}`,
      description: `File size: ${fileInfo.fileSize}. Expires on: ${expirationDate}.`,
      type: 'website',
    },
  };
}

// Ana sayfa bileşeni (Sunucu Bileşeni)
export default async function FilePage(props: FilePageProps) {
  const params = await props.params;
  const fileInfo = await getFileInfo(params.fileId);

  // Yükleniyor durumu (normalde anlık olmalı)
  if (fileInfo === undefined) {
     return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
        <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <p className="text-zinc-400 text-center mt-4">Loading file information...</p>
        </div>
      </div>
    );
  }

  // Hata veya bulunamama durumu
  if (!fileInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
        <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
          <h2 className="text-red-400 text-2xl font-bold text-center mb-4">File Not Found</h2>
          <div className="text-center text-zinc-300 mb-6">
            <p>The file you&apos;re looking for could not be found or may have expired.</p>
          </div>
          <div className="flex justify-center">
            <Link href="/">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Süresi dolmuş dosya durumu
  if (fileInfo.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
        <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
          <h2 className="text-yellow-400 text-2xl font-bold text-center mb-4">File Has Expired</h2>
          <div className="text-center text-zinc-300 mb-6">
            <p>The sharing period for this file has ended.</p>
          </div>
          <div className="flex justify-center">
            <Link href="/">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // İşlenmekte olan dosya durumu
  if (fileInfo.status !== 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
        <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
          <h2 className="text-blue-400 text-2xl font-bold text-center mb-4">File Processing</h2>
          <div className="text-center text-zinc-300 mb-6">
            <p>The file is still being processed. Please try again later.</p>
            <p className="mt-2 text-sm text-zinc-500">
              Processed chunks: {fileInfo.receivedChunks?.length ?? 0}/{fileInfo.totalChunks}
            </p>
          </div>
          <div className="flex justify-center">
            <Link href="/">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Başarılı durum -> İstemci bileşenini render et
  return <FilePageClient fileInfo={fileInfo} fileId={params.fileId} />;
}
 