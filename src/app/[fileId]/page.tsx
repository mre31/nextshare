"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LocaleDate from '@/components/LocaleDate';

// Next.js 15.2+ ile uyumlu params tipi
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

// Component for password entry
interface PasswordEntryProps {
  fileId: string;
  onDownload: (password: string) => void;
}

function PasswordEntry({ fileId, onDownload }: PasswordEntryProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Please enter the password');
      return;
    }
    
    if (!/^\d{4}$/.test(password)) {
      setError('Password must be 4 digits');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Validate password
      const response = await fetch(`/api/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Password is correct, trigger download
        onDownload(password);
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-zinc-700/30 rounded-lg p-5 mb-6">
      <div className="flex items-center justify-center mb-4">
        <div className="bg-yellow-500/20 p-2 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
      </div>
      
      <h3 className="text-lg font-semibold text-center text-white mb-2">
        This file is password protected
      </h3>
      <p className="text-sm text-center text-zinc-300 mb-4">
        Enter the 4-digit password to download the file.
      </p>
      
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
        
        <Button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Verifying...' : 'Unlock File'}
        </Button>
      </form>
    </div>
  );
}

export default function FilePage({ params }: FilePageProps) {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string>('');
  
  // Set the fileId from params at component mount
  useEffect(() => {
    const resolveParams = async () => {
      try {
        // Use Promise.resolve to handle both Promise and non-Promise params
        const resolvedParams = await Promise.resolve(params);
        setFileId(resolvedParams.fileId);
      } catch (err) {
        console.error('Error resolving params:', err);
        setError('Failed to load file information');
        setLoading(false);
      }
    };
    
    resolveParams();
  }, [params]);
  
  // Fetch file info when fileId is available
  useEffect(() => {
    if (!fileId) return;
    
    const fetchFileInfo = async () => {
      try {
        const response = await fetch(`/api/file-info/${fileId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch file information');
        }
        
        const data = await response.json();
        setFileInfo(data);
      } catch (err) {
        setError('Failed to load file information');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFileInfo();
  }, [fileId]);
  
  const handlePasswordSubmit = (password: string) => {
    if (!fileId) return;
    
    // Create download URL with password
    const downloadUrl = `/api/${fileId}?password=${password}`;
    
    // Create a temporary link and click it to start download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileInfo?.fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (loading) {
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
  
  if (error || !fileInfo) {
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
  
  if (fileInfo.status !== 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
        <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
          <h2 className="text-blue-400 text-2xl font-bold text-center mb-4">File Processing</h2>
          <div className="text-center text-zinc-300 mb-6">
            <p>The file is still being processed. Please try again later.</p>
            <p className="mt-2 text-sm text-zinc-500">
              Processed chunks: {fileInfo.receivedChunks?.length}/{fileInfo.totalChunks}
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
  
  // Success state - file download page
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
      <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
        <h2 className="text-white text-2xl font-bold text-center mb-6">Download File</h2>
        
        <div className="bg-zinc-700/50 rounded-lg p-4 mb-6">
          <div className="space-y-2">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-zinc-400">File Name:</span>
              <span className="text-zinc-200 font-medium truncate" title={fileInfo.fileName}>
                {fileInfo.fileName.length > 25 
                  ? fileInfo.fileName.substring(0, 22) + '...' 
                  : fileInfo.fileName
                }
              </span>
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
          <PasswordEntry 
            fileId={fileId} 
            onDownload={handlePasswordSubmit} 
          />
        ) : (
          <div className="flex justify-center">
            <a href={`/api/${fileId}`} download={fileInfo.fileName} className="w-full">
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