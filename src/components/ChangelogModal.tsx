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
            {/* Version 3.0.1 */}
            <div className="space-y-2">
              <h4 className="text-blue-400 font-semibold flex items-center">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                Version 3.0.1
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  Current
                </span>
              </h4>
              <div className="pl-4 border-l border-zinc-700 ml-1 text-sm space-y-2 text-zinc-300">
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
          For more details, visit our GitHub repository
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal; 