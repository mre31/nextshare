"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileIcon, Upload, Clock, Check, Link2, Calendar, LockIcon } from "lucide-react";

// Yüklenen dosya tipi
interface UploadedFile {
  id: string;
  name: string;
  date: string;
  expiryDate: string;
  isEncrypted: boolean;
}

// Custom event ismi
const UPLOAD_EVENT = "recentUploadUpdated";

const RecentUploads = () => {
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // LocalStorage'den yüklemeleri al
  const loadUploadsFromStorage = () => {
    if (typeof window === 'undefined') return;
    
    const storedUploads = localStorage.getItem("recentUploads");
    if (storedUploads) {
      try {
        setUploads(JSON.parse(storedUploads));
      } catch (error) {
        console.error("Recent uploads parsing error:", error);
        // Hatalı veri varsa temizle
        localStorage.removeItem("recentUploads");
      }
    }
  };

  // İlk yükleme
  useEffect(() => {
    setIsClient(true);
    loadUploadsFromStorage();
    
    // Storage değişikliklerini dinle
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "recentUploads") {
        loadUploadsFromStorage();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Custom event dinleyicisi ekle
    window.addEventListener(UPLOAD_EVENT, loadUploadsFromStorage);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(UPLOAD_EVENT, loadUploadsFromStorage);
    };
  }, []);

  // Öğeyi sil
  const removeItem = (id: string) => {
    const updatedUploads = uploads.filter((upload) => upload.id !== id);
    setUploads(updatedUploads);
    
    // LocalStorage'i güncelle
    localStorage.setItem("recentUploads", JSON.stringify(updatedUploads));
    
    // Custom event gönder
    window.dispatchEvent(new Event(UPLOAD_EVENT));
  };

  // Tüm yüklemeleri temizle
  const clearAll = () => {
    setUploads([]);
    localStorage.removeItem("recentUploads");
  };

  // Bağlantıyı kopyala
  const copyLink = (id: string) => {
    const link = `${window.location.origin}/${id}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
      });
  };

  // Son 5 dosyayı al
  const latestUploads = uploads.slice(0, 5);

  // Widget gizli ise gösterme
  if (!isClient) {
    return null;
  }

  return (
    <div className="fixed right-0 top-1/2 transform -translate-y-1/2 z-50">
      <div className={`transition-all duration-500 ease-out transform ${isExpanded ? 'translate-x-0' : 'translate-x-[calc(100%-45px)]'}`}>
        <div 
          className="bg-zinc-800 rounded-l-lg overflow-hidden border-l-0 border border-zinc-700/50 flex shadow-lg"
          onMouseEnter={() => setIsExpanded(true)}
          onMouseLeave={() => setIsExpanded(false)}
        >
          {/* Tab kısmı */}
          <div className="bg-zinc-700 py-6 px-2 flex items-center rotate-180 shrink-0 w-[30px]" style={{ writingMode: 'vertical-lr' }}>
            <span className="text-white font-medium uppercase tracking-wider text-xs flex items-center gap-2">
              <Clock className="w-3 h-3 text-blue-400 rotate-180" />
              Recent Uploads
            </span>
          </div>

          <div className="flex-grow w-72">
            {latestUploads.length > 0 ? (
              <div className="max-h-[70vh] overflow-y-auto p-2 grid grid-cols-1 gap-2">
                {latestUploads.map((file) => (
                  <div 
                    key={file.id} 
                    className="bg-zinc-700/50 rounded-md hover:bg-zinc-700 transition-colors shadow border border-zinc-700/70"
                  >
                    <div className="flex items-center h-11 px-2 gap-2 relative">
                      <div className={`${file.isEncrypted ? 'bg-yellow-500/10' : 'bg-blue-500/10'} p-1 rounded-sm`}>
                        {file.isEncrypted ? (
                          <LockIcon className="w-4 h-4 text-yellow-400" />
                        ) : (
                          <FileIcon className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <a 
                          href={`/${file.id}`} 
                          className="text-zinc-200 text-sm font-medium block truncate hover:text-blue-400 transition-colors"
                          title={file.name}
                        >
                          {file.name}
                        </a>
                        <div className="flex items-center text-[10px] text-zinc-500">
                          <Calendar className="w-2.5 h-2.5 mr-1 text-blue-400/80" />
                          <span>Expires: {file.expiryDate.split(',')[0].trim()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className={`p-1 rounded-sm ${copiedId === file.id ? 'bg-green-600/30 text-green-300' : 'text-zinc-400 hover:bg-zinc-600/50'}`}
                          onClick={() => copyLink(file.id)}
                          title="Copy Link"
                        >
                          {copiedId === file.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Link2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeItem(file.id);
                          }}
                          className="p-1 text-zinc-400 hover:bg-zinc-600/50 rounded-sm"
                          title="Remove"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center justify-center text-center">
                <div className="bg-blue-500/20 rounded-full p-3 mb-3">
                  <Upload className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-zinc-300 mb-1">No uploads yet</p>
                <p className="text-xs text-zinc-500 mb-4">
                  Files will appear here after upload
                </p>
              </div>
            )}
            
            {uploads.length > 0 && (
              <div className="p-2 border-t border-zinc-700">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs bg-zinc-700 border-zinc-600 hover:bg-zinc-600 text-zinc-300" 
                  onClick={clearAll}
                >
                  Clear All
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper fonksiyon - dışarıdan çağrılabilir
export const notifyRecentUploadsChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UPLOAD_EVENT));
  }
};

export default RecentUploads; 