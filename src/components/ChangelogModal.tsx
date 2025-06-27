"use client";

import { X } from "lucide-react";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangelogModal = ({ isOpen, onClose }: ChangelogModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div 
        className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-md mx-4 border border-zinc-700 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-lg font-medium text-white">Changelog</h3>
          <button 
            className="p-1.5 rounded-md hover:bg-zinc-700 focus:outline-none"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        
        {/* Modal content */}
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Version 3.2.0 */}
            <div className="space-y-2">
              <h4 className="text-blue-400 font-semibold flex items-center">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                Version 3.2.0
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Current
                </span>
              </h4>
              <div className="pl-4 border-l border-zinc-700 ml-1 text-sm space-y-2 text-zinc-300">
                <p>• <strong>SEO & UX Improvment:</strong> The file download page now dynamically generates metadata (title and description) based on file details (name, size, expiration), improving SEO and user experience.</p>
                <p>• <strong>Architectural Refactor:</strong> Refactored the download page to use Next.js Server Components, fetching data on the server for faster page loads and better performance.</p>
                <p>• <strong>Enhanced Security:</strong> The password verification for protected files now occurs on the backend via a POST request, preventing the password from being exposed in the URL.</p>
                <p>• <strong>Corrected "Direct Link":</strong> The "Copy Direct Download Link" button now correctly copies the direct API download link to the clipboard.</p>
              </div>
            </div>

            {/* Version 3.1.0 */}
            <div className="space-y-2">
              <h4 className="text-zinc-400 font-semibold flex items-center">
                <span className="inline-block w-2 h-2 bg-zinc-400 rounded-full mr-2"></span>
                Version 3.1.0
              </h4>
              <div className="pl-4 border-l border-zinc-700 ml-1 text-sm space-y-2 text-zinc-300">
                <p>• Fixed client-side file chunking for large file uploads.</p>
                <p>• Added SHA-256 hash verification for each uploaded chunk (client-side and server-side) to ensure data integrity.</p>
                <p>• Overhauled server-side upload logic to support chunked uploads, assembly, and processing.</p>
              </div>
            </div>
            
            {/* Version 3.0.2 */}
            <div className="space-y-2">
              <h4 className="text-zinc-400 font-semibold flex items-center">
                <span className="inline-block w-2 h-2 bg-zinc-400 rounded-full mr-2"></span>
                Version 3.0.2
              </h4>
              <div className="pl-4 border-l border-zinc-700 ml-1 text-sm space-y-2 text-zinc-300">
                <p>• Redesigned URL structure, now using a single format for file sharing</p>
                <p>• Removed /share/ URL route, only using share.frondev.com/fileid format</p>
                <p>• Improved UI/UX user experience</p>
                <p>• API endpoint changes for direct download links</p>
                <p>• Bug fixes and performance improvements</p>
              </div>
            </div>
            
            {/* Version 3.0.1 */}
            <div className="space-y-2">
              <h4 className="text-zinc-400 font-semibold flex items-center">
                <span className="inline-block w-2 h-2 bg-zinc-400 rounded-full mr-2"></span>
                Version 3.0.1
              </h4>
              <div className="pl-4 border-l border-zinc-700 ml-1 text-sm space-y-2 text-zinc-400">
                <p>• Added Recent Uploads widget</p>
                <p>• Improved file card design</p>
                <p>• Added encrypted file indication with lock icon</p>
                <p>• Quick copy link feature in Recent Uploads</p>
                <p>• Added direct API download links for faster downloads</p>
                <p>• Fixed Recent Uploads to copy download page link instead of direct link</p>
                <p>• Changed default file retention period to 24 hours</p>
              </div>
            </div>
            
            {/* Version 3.0.0 */}
            <div className="space-y-2">
              <h4 className="text-zinc-400 font-semibold flex items-center">
                <span className="inline-block w-2 h-2 bg-zinc-400 rounded-full mr-2"></span>
                Version 3.0.0
              </h4>
              <div className="pl-4 border-l border-zinc-700 ml-1 text-sm space-y-2 text-zinc-400">
                <p>• Complete redesign with modern UI</p>
                <p>• Added file encryption support</p>
                <p>• Improved file uploading with chunking</p>
                <p>• Auto file deletion after expiry</p>
                <p>• Mobile-friendly interface</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Modal footer */}
        <div className="p-4 border-t border-zinc-700 text-center text-xs text-zinc-500">
          For more details, visit our <a href="https://github.com/mre31/nextshare" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline focus:outline-none transition">GitHub</a> repository.
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal; 