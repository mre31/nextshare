'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LocaleDate from '@/components/LocaleDate';

// Arayüzler
interface FileInfo {
  fileName: string;
  fileSize: string;
  expiresAt: number;
  isEncrypted: boolean;
}

interface FilePageClientProps {
  fileInfo: FileInfo;
  fileId: string;
}

// Şifre giriş bileşeni
function PasswordEntry({ fileId, onDownload, fileName }: { fileId: string; onDownload: (password: string) => void; fileName: string; }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(password)) {
      setError('Password must be 4 digits');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      // API'ye şifreyi doğrulamak için bir istek gönder
      const response = await fetch(`/api/download/${fileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        // Şifre doğruysa, indirmeyi tetikle
        onDownload(password);
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-700/30 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-center mb-4">
            <div className="bg-yellow-500/20 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
        </div>
        <h3 className="text-lg font-semibold text-center text-white mb-2">This file is password protected</h3>
        <p className="text-sm text-center text-zinc-300 mb-4">Enter the 4-digit password to download the file.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <Input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter 4-digit password"
                    className="bg-zinc-800 border-zinc-600 text-zinc-200 text-center text-xl tracking-widest"
                    disabled={isSubmitting}
                />
                {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white cursor-pointer" disabled={isSubmitting}>
                {isSubmitting ? 'Verifying...' : 'Unlock File'}
            </Button>
        </form>
    </div>
  );
}

// Ana istemci bileşeni
export default function FilePageClient({ fileInfo, fileId }: FilePageClientProps) {
  const handlePasswordDownload = (password: string) => {
    // Şifre doğrulandıktan sonra, indirme linkini oluştur ve tetikle
    const downloadUrl = `/api/download/${fileId}?password=${password}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileInfo.fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
      <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
        <h2 className="text-white text-2xl font-bold text-center mb-6">Download File</h2>
        <div className="bg-zinc-700/50 rounded-lg p-4 mb-6">
          <div className="space-y-2">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-zinc-400">File Name:</span>
              <span className="text-zinc-200 font-medium truncate" title={fileInfo.fileName}>{fileInfo.fileName}</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-zinc-400">File Size:</span>
              <span className="text-zinc-200">{fileInfo.fileSize}</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-zinc-400">Available until:</span>
              <LocaleDate timestamp={fileInfo.expiresAt} />
            </div>
          </div>
        </div>
        {fileInfo.isEncrypted ? (
          <PasswordEntry fileId={fileId} onDownload={handlePasswordDownload} fileName={fileInfo.fileName} />
        ) : (
          <div className="flex justify-center">
            <a href={`/api/download/${fileId}`} download={fileInfo.fileName} className="w-full">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full py-2 rounded-md transition-all cursor-pointer">
                Start Download
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
