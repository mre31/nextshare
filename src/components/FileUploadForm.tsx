"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { generateUniqueFileId } from "@/lib/fileUtils";
import { notifyRecentUploadsChanged } from "@/components/RecentUploads";

// Custom animation styles
const animationStyles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
  }
  
  @keyframes slideDown {
    from { transform: translateY(-15px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  .animate-slide-down {
    animation: slideDown 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    opacity: 0; /* Başlangıçta gizli */
  }
  
  .form-to-success-transition {
    transition: all 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  
  .success-view-animation-ready {
    will-change: opacity, transform;
  }
  
  .slide-1 { animation-delay: 100ms; }
  .slide-2 { animation-delay: 250ms; }
  .slide-3 { animation-delay: 400ms; }
  .slide-4 { animation-delay: 550ms; }
  .slide-5 { animation-delay: 700ms; }
  
  @keyframes slideInFromBottom {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  .progress-container-enter {
    animation: slideInFromBottom 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes progressShimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  
  .progress-shimmer {
    background: linear-gradient(90deg, 
      rgba(59, 130, 246, 0.8) 0%, 
      rgba(59, 130, 246, 1) 25%, 
      rgba(59, 130, 246, 0.8) 50%, 
      rgba(59, 130, 246, 1) 75%, 
      rgba(59, 130, 246, 0.8) 100%
    );
    background-size: 200% 100%;
    animation: progressShimmer 2s infinite linear;
  }
`;

// Progress bar component
const ProgressBar = ({ progress }: { progress: number }) => {
  return (
    <div className="w-full bg-zinc-700 rounded-full h-3 mb-2 overflow-hidden">
      <div 
        className="h-full rounded-full transition-all duration-300 ease-in-out relative"
        style={{ width: `${progress}%` }}
      >
        {/* Statik arkaplan */}
        <div className="absolute inset-0 bg-blue-500"></div>
        
        {/* Animasyonlu parlama efekti */}
        <div className="absolute inset-0 progress-shimmer"></div>
      </div>
    </div>
  );
};

// Check icon
const CheckIcon = () => (
  <div className="bg-green-500 rounded-full p-4 inline-flex items-center justify-center mb-6">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

// Recent uploads yükleme işlevi
const saveRecentUpload = (fileData: {
  id: string;
  name: string;
  date: string;
  expiryDate: string;
  isEncrypted: boolean;
}) => {
  // localStorage'den mevcut yüklemeleri al
  const storedUploads = localStorage.getItem("recentUploads");
  let recentUploads = [];
  
  if (storedUploads) {
    try {
      recentUploads = JSON.parse(storedUploads);
    } catch (error) {
      console.error("Error parsing recent uploads:", error);
      // Hatalı veri varsa temizle
      localStorage.removeItem("recentUploads");
      recentUploads = [];
    }
  }
  
  // Yeni dosyayı en başa ekle
  recentUploads.unshift(fileData);
  
  // Maksimum 10 öğe tut
  if (recentUploads.length > 10) {
    recentUploads = recentUploads.slice(0, 10);
  }
  
  // Güncellenmiş listeyi kaydet
  localStorage.setItem("recentUploads", JSON.stringify(recentUploads));
};

// Helper function to calculate SHA-256 hash of an ArrayBuffer
async function calculateFileChunkHash(chunkBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', chunkBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

const FileUploadForm = () => {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<string>("24");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const linkRef = useRef<HTMLInputElement>(null);
  const [copyButtonText, setCopyButtonText] = useState<string>("Copy Direct Download Link");
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  
  // Encryption related states
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Add state for animation timing
  const [showSuccessItems, setShowSuccessItems] = useState(false);
  
  // Effect to handle animation timing
  useEffect(() => {
    let timer1: NodeJS.Timeout;
    
    if (uploadSuccess) {
      // İlk aşama: Başarı container'ı görünür olduğunda
      timer1 = setTimeout(() => {
        setShowSuccessItems(true);
      }, 500);
      
      return () => {
        clearTimeout(timer1);
      };
    } else {
      setShowSuccessItems(false);
    }
  }, [uploadSuccess]);

  // Clean up temporary files when component unmounts or upload is cancelled
  useEffect(() => {
    // Cleanup function
    return () => {
      if (currentFileId && !uploadSuccess) {
        // Bu fonksiyon sunucu tarafında geçici dosyaları temizlemek için hala geçerli olabilir,
        // özellikle stream yarıda kesilirse veya hata oluşursa.
        // Ancak, sunucu tarafı artık kendi temizliğini büyük ölçüde yönetiyor.
        // İstemci tarafında bir iptal butonu eklenirse bu çağrı yine de önemli olabilir.
        // cleanupTempFiles(currentFileId); // Şimdilik yoruma alalım, sunucu tarafı zaten yapıyor.
      }
    };
  }, [currentFileId, uploadSuccess]);

  // Function to clean up temporary files - Bu fonksiyonun istemci tarafı implementasyonu kaldırılabilir
  // Sunucu tarafı zaten /api/cleanup/temp üzerinden bir temizleme mekanizmasına sahip olabilir
  // veya yeni stream mekanizması kendi içinde hataları yönetir.
  /*
  const cleanupTempFiles = async (fileId: string) => {
    try {
      const response = await fetch(`/api/cleanup/temp?fileId=${fileId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        console.log(`Temporary files cleaned: ${fileId}`);
      } else {
        console.error("Error cleaning temporary files");
      }
    } catch (error) {
      console.error("Error cleaning temporary files:", error);
    }
  };
  */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage(null);
      setShareLink(null);
      setUploadSuccess(false);
      setProgress(0); // Dosya değiştiğinde progress'i sıfırla
    }
  };

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setErrorMessage(null);
      setShareLink(null);
      setUploadSuccess(false);
      setProgress(0); // Dosya değiştiğinde progress'i sıfırla
    }
  }, []);

  const calculateExpiryDate = (durationHours: number) => {
    const date = new Date();
    date.setHours(date.getHours() + durationHours);
    
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const copyToClipboard = () => {
    const shareUrl = `${window.location.origin}/api/download/${shareLink}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        if (linkRef.current) {
          linkRef.current.select();
        }
        setCopyButtonText("Share Link Copied!");
        setTimeout(() => {
          setCopyButtonText("Copy Direct Download Link");
        }, 3000);
      })
      .catch(err => {
        console.error('Failed to copy share link:', err);
      });
  };

  const validatePassword = (): boolean => {
    setPasswordError(null);
    if (!isEncrypted) return true;
    if (!/^\d{4}$/.test(password)) {
      setPasswordError("Password must be exactly 4 digits");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Please select a file first.");
      return;
    }
    const currentFile = file;

    if (isEncrypted && !validatePassword()) {
      return;
    }

    setUploading(true);
    setProgress(0);
    setErrorMessage(null);
    setShareLink(null);
    setUploadSuccess(false);
    setCurrentFileId(null);

    const fileId = generateUniqueFileId();
    setCurrentFileId(fileId);

    const calculatedExpiryDate = calculateExpiryDate(parseInt(duration));
    setExpiryDate(calculatedExpiryDate);

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunk size
    const totalChunks = Math.ceil(currentFile.size / CHUNK_SIZE);
    let finalShareLink: string | null = null;
    let chunksSuccessfullyUploaded = 0;

    // Aynı anda en fazla kaç chunk yükleneceği
    const MAX_CONCURRENT_UPLOADS = 4; 

    console.log("Preparing chunks and calculating hashes in parallel...");

    try {
      // 1. Chunk'ları hazırla ve hash'lerini paralel olarak hesapla (öncekiyle aynı)
      const hashPromises = [];
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, currentFile.size);
        const chunkBlob = currentFile.slice(start, end);
        hashPromises.push(
          (async (currentIndex: number) => {
            const chunkBuffer = await chunkBlob.arrayBuffer();
            const chunkHash = await calculateFileChunkHash(chunkBuffer);
            return { chunkBlob, chunkHash, chunkIndex: currentIndex, originalFileName: currentFile.name };
          })(i)
        );
      }
      
      const preparedChunks = await Promise.all(hashPromises);
      console.log("All chunks prepared and hashes calculated.");
      setProgress(1); // Hashing bitti, yükleme başlıyor (veya %0'da kalabilir)

      // 2. Hazırlanan chunk'ları SINIRLI PARALELLİKTE yükle
      if (totalChunks > 0) {
        await new Promise<void>((resolve, reject) => {
          let currentlyUploading = 0;
          let nextChunkIndexToUpload = 0;
          // chunkIndex'e göre sıralı olduğundan emin olalım (Promise.all sırayı korur ama yine de)
          preparedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

          function uploadNextChunk() {
            if (chunksSuccessfullyUploaded === totalChunks) {
              resolve();
              return;
            }

            while (currentlyUploading < MAX_CONCURRENT_UPLOADS && nextChunkIndexToUpload < totalChunks) {
              const preparedChunk = preparedChunks[nextChunkIndexToUpload];
              if (!preparedChunk) {
                // Bu durum olmamalı ama bir güvenlik kontrolü
                console.warn("Undefined prepared chunk at index", nextChunkIndexToUpload);
                nextChunkIndexToUpload++; // Hatalı index'i atla
                continue;
              }
              nextChunkIndexToUpload++;
              currentlyUploading++;

              const { chunkBlob, chunkHash, chunkIndex, originalFileName } = preparedChunk;
              
              console.log(`Starting upload for chunk ${chunkIndex + 1}/${totalChunks}`);
              const formData = new FormData();
              formData.append("fileId", fileId);
              formData.append("fileName", originalFileName);
              formData.append("fileSize", currentFile.size.toString());
              formData.append("duration", duration);
              formData.append("isEncrypted", String(isEncrypted));
              if (isEncrypted && password) {
                formData.append("password", password);
              }
              formData.append("chunk", chunkBlob, `${originalFileName}.chunk${chunkIndex}`);
              formData.append("chunkIndex", chunkIndex.toString());
              formData.append("totalChunks", totalChunks.toString());
              formData.append("chunkHash", chunkHash);

              fetch("/api/upload", { method: "POST", body: formData })
                .then(async response => {
                  currentlyUploading--;
                  if (!response.ok) {
                    const errorData = await response.text();
                    const errorMsg = `Upload failed for chunk ${chunkIndex + 1}/${totalChunks}: ${response.status} ${errorData || response.statusText}`;
                    console.error(errorMsg);
                    // Bir chunk hata verdiğinde tüm yüklemeyi durdur
                    // Diğer devam eden fetch'ler yine de tamamlanabilir veya iptal edilebilir (AbortController ile)
                    // Şimdilik sadece reject ediyoruz.
                    return reject(new Error(errorMsg)); 
                  }
                  chunksSuccessfullyUploaded++;
                  const currentProgress = Math.round((chunksSuccessfullyUploaded / totalChunks) * 100);
                  setProgress(currentProgress);
                  console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded. Progress: ${currentProgress}%`);

                  // Son chunk ise ve başarılıysa URL'i al
                  if (chunksSuccessfullyUploaded === totalChunks) {
                    // Sunucudan gelen yanıtı JSON olarak işle
                    // Bu fetch'in sonucu da diğerleriyle aynı anda gelebilir, bu yüzden son chunk olup olmadığını kontrol etmeliyiz.
                    // Gerçek finalShareLink ataması Promise çözüldükten sonra yapılmalı.
                    response.json().then(result => {
                        if (result.url) {
                            finalShareLink = result.url; 
                            console.log("Final share link received from server on last chunk:", finalShareLink);
                        } else {
                            console.error("Last chunk response did not contain a URL:", result);
                            // finalShareLink null kalırsa, dışarıdaki kontrol bunu yakalar.
                        }
                        uploadNextChunk(); // Tüm chunklar yüklendi, resolve() çağrılacak.
                    }).catch(jsonError => {
                        console.error("Error parsing JSON from last chunk response:", jsonError);
                        reject(new Error("Failed to parse server response for the final chunk."));
                    });
                  } else {
                    uploadNextChunk(); // Bir sonraki chunk'ı yüklemeye başla
                  }
                })
                .catch(networkError => {
                  currentlyUploading--;
                  console.error(`Network error during upload of chunk ${chunkIndex + 1}/${totalChunks}:`, networkError);
                  reject(networkError); // Bir ağ hatasında tüm yüklemeyi durdur
                });
            }
          }
          uploadNextChunk(); // İlk chunk(lar)ı yüklemeye başla
        });
      } else if (totalChunks === 0 && currentFile && currentFile.size === 0) {
        if (currentFile) {
            const formData = new FormData();
            formData.append("fileId", fileId);
            formData.append("fileName", currentFile.name);
            formData.append("fileSize", "0");
            formData.append("duration", duration);
            formData.append("isEncrypted", String(isEncrypted));
            if (isEncrypted && password) formData.append("password", password);
            formData.append("totalChunks", "1"); 
            formData.append("chunkIndex", "0");
            
            console.log("File is empty. Not attempting chunked upload. This scenario might need specific handling.");
            setErrorMessage("Cannot upload an empty file.");
            setUploading(false);
            return; 
        } else {
            // Bu bloğa normalde girilmemeli, çünkü dışarıda file kontrolü var
            setErrorMessage("File not found while handling empty file case.");
            setUploading(false);
            return;
        }
      }

      // Tüm yüklemeler tamamlandıktan sonra finalShareLink kontrolü
      if (chunksSuccessfullyUploaded === totalChunks && finalShareLink) {
        setShareLink(finalShareLink);
        setUploadSuccess(true);
        const newUploadData = {
          id: fileId,
          name: currentFile.name,
          date: new Date().toISOString(),
          expiryDate: calculatedExpiryDate,
          isEncrypted: isEncrypted,
        };
        saveRecentUpload(newUploadData);
        notifyRecentUploadsChanged();
      } else if (chunksSuccessfullyUploaded === totalChunks && !finalShareLink && totalChunks > 0) {
        // Tüm chunklar yüklendi ama URL yok (bu durum yukarıda da loglanmış olmalı)
        throw new Error("All chunks uploaded but the server did not provide a share link.");
      } else if (chunksSuccessfullyUploaded !== totalChunks && totalChunks > 0) {
        // Beklenmedik bir durum, tüm chunklar yüklenemedi ama hata da fırlatılmadı?
        throw new Error("Upload did not complete fully, but no specific error was caught.");
      }
      // totalChunks === 0 durumu yukarıda handle edildi (şimdilik hata olarak)

    } catch (error: unknown) {
      console.error("Upload error:", error);
      let AImessage = "An unexpected error occurred during upload.";
      if (error instanceof Error) {
        AImessage = error.message;
      }
      setErrorMessage(AImessage);
      // Consider if a cleanup call to the server is needed for partially uploaded files
      // if (fileId) cleanupPartialUpload(fileId); // Example call
    } finally {
      setUploading(false);
      if (isEncrypted) {
        setPassword(''); // Clear password after upload attempt
      }
    }
  };

  const resetForm = () => {
    // Sunucu tarafı stream hatalarında veya tamamlanmamış yüklemelerde kendi temizliğini yapar.
    // Bu yüzden currentFileId ile özel bir cleanup çağırmaya gerek kalmayabilir.
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    setCurrentFileId(null);
    setFile(null);
    setUploadSuccess(false);
    setShareLink(null);
    setErrorMessage(null);
    setIsEncrypted(false);
    setPassword('');
    setPasswordError(null);
    setProgress(0);
  };

  return (
    <div className="bg-zinc-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-auto">
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      <div className="relative min-h-[500px]">
        <div 
          className={`
            form-to-success-transition
            ${uploadSuccess 
              ? 'opacity-0 invisible absolute inset-0 z-0 transform translate-y-10 pointer-events-none' 
              : 'opacity-100 relative z-10 transform translate-y-0'
            }
          `}
        >
          <h2 className="text-white text-2xl font-bold text-center mb-8">Share Your File</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${dragActive ? 'border-blue-500 bg-zinc-700/20' : 'border-blue-500/60 hover:border-blue-500'}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <div className="h-14 flex flex-col items-center justify-center">
                {file ? (
                  <div className="text-zinc-300 animate-fade-in transition-all duration-300 ease-in-out">
                    <p className="font-medium truncate" title={file.name}>
                      {file.name.length > 25 
                        ? file.name.substring(0, 22) + '...' 
                        : file.name
                      }
                    </p>
                    <p className="text-sm text-zinc-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <p className="text-zinc-300 animate-fade-in transition-opacity duration-300 ease-in-out">
                    Choose or drop a file to share
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between bg-zinc-700/30 rounded-lg p-3">
              <div>
                <Label htmlFor="duration" className="text-zinc-300 font-medium">Active duration</Label>
                <p className="text-xs text-zinc-400 mt-1">How long the file will be available</p>
              </div>
              <div className="w-32 flex justify-end">
                <Select
                  value={duration}
                  onValueChange={(value: string) => setDuration(value)}
                  disabled={uploading}
                >
                  <SelectTrigger id="duration" className="bg-zinc-700 border-zinc-600 text-zinc-200 w-32">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-700 border-zinc-600 text-zinc-200">
                    {[1, 3, 6, 9, 12, 15, 18, 21, 24].map((hours) => (
                      <SelectItem key={hours} value={hours.toString()} className="hover:bg-zinc-600">
                        {hours} hour{hours > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex flex-col space-y-4">
              <div className="bg-zinc-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="encrypt-toggle" className="text-zinc-300 font-medium">Set a password</Label>
                    <p className="text-xs text-zinc-400 mt-1">Protect your file with a password</p>
                  </div>
                  <div className="w-32 flex justify-end">
                    <Switch 
                      id="encrypt-toggle" 
                      checked={isEncrypted} 
                      onCheckedChange={setIsEncrypted}
                      disabled={uploading}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>
                </div>
                <div 
                  className={`
                    overflow-hidden transition-all duration-300 ease-in-out
                    ${isEncrypted ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}
                  `}
                >
                  <div className={`pt-2 border-t border-zinc-600/50 ${isEncrypted ? '' : 'invisible'}`}>
                    <Input
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      maxLength={4}
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4}"
                      placeholder="4 digit password"
                      className="bg-zinc-700 border-zinc-600 text-zinc-200 outline-none ring-0 
                                focus:outline-none focus:ring-0 focus:border-zinc-600 hover:border-zinc-600
                                focus-visible:outline-none focus-visible:ring-0 focus-visible:border-zinc-600
                                active:outline-none active:ring-0 active:border-zinc-600"
                      style={{ outline: 'none' }}
                      disabled={uploading}
                      autoComplete="off"
                      autoSave="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck="false"
                    />
                    {passwordError && (
                      <p className="text-xs text-red-400 mt-1">{passwordError}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div 
              className={`
                overflow-hidden transition-all duration-500 ease-in-out
                ${uploading ? 'max-h-32 opacity-100 my-6' : 'max-h-0 opacity-0 my-0'}
              `}
            >
              <div className="progress-container-enter">
                <ProgressBar progress={progress} />
                <p className="text-sm text-center text-yellow-400">
                  {uploading ? `Please don't leave the page until upload finishes.` : (file ? "Ready to upload" : "Select a file")}
                </p>
              </div>
            </div>
            
            {errorMessage && !uploading && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-md">
                <p className="text-red-400 text-sm">Error: {errorMessage}</p>
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:scale-[1.02] cursor-pointer"
              disabled={!file || uploading}
            >
              {uploading 
                ? `Uploading (${progress}%)` 
                : "Generate Link"}
            </Button>
          </form>
        </div>
        
        <div 
          className={`
            form-to-success-transition success-view-animation-ready w-full overflow-hidden
            ${uploadSuccess 
              ? 'opacity-100 visible relative z-10 transform translate-y-0' 
              : 'opacity-0 invisible absolute inset-0 z-0 transform -translate-y-10 pointer-events-none'
            }
          `}
          style={{ transitionDuration: '650ms' }}
        >
          {shareLink && (
            <div className="flex flex-col items-center text-center">
              <div className={`${showSuccessItems ? 'animate-slide-down slide-1' : 'opacity-0'}`}>
                <CheckIcon />
              </div>
              <div className={`${showSuccessItems ? 'animate-slide-down slide-2' : 'opacity-0'}`}>
                <h2 className="text-white text-2xl font-bold mb-4">File uploaded successfully!</h2>
              </div>
              <div className={`${showSuccessItems ? 'animate-slide-down slide-3' : 'opacity-0'}`}>
                <p className="text-zinc-300 mb-4">Your file is ready to share. The link will be valid until:</p>
                <p className="text-zinc-300 mb-6 font-medium">{expiryDate}</p>
              </div>
              {isEncrypted && (
                <div className={`mb-6 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-md ${showSuccessItems ? 'animate-slide-down slide-3' : 'opacity-0'}`}>
                  <p className="text-yellow-300 font-medium">This file is encrypted</p>
                  <p className="text-yellow-300/80 text-sm">
                    The recipient will need the 4-digit password to download this file
                  </p>
                </div>
              )}
              <div className={`border-2 border-dashed border-blue-500/60 rounded-lg p-4 w-full mb-6 ${showSuccessItems ? 'animate-slide-down slide-4' : 'opacity-0'}`}>
                <p className="text-zinc-300 mb-2">Share this link:</p>
                <input
                  ref={linkRef}
                  type="text"
                  readOnly
                  value={`${window.location.origin}/${shareLink}`}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-zinc-300 text-center mb-2"
                />
                <p className="text-zinc-400 text-xs">
                  Click on the link to select it, then press Ctrl+C (or Cmd+C on Mac) to copy
                </p>
              </div>
              <div className={`flex flex-col w-full gap-3 ${showSuccessItems ? 'animate-slide-down slide-5' : 'opacity-0'}`}>
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer"
                  onClick={() => copyToClipboard()}
                >
                  {copyButtonText}
                </Button>
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer"
                  onClick={resetForm}
                >
                  Share Another File
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploadForm; 