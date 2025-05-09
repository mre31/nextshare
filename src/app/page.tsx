"use client";

import { useState } from "react";
import FileUploadForm from "@/components/FileUploadForm";
import ChangelogModal from "@/components/ChangelogModal";

export default function Home() {
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-900">
      {/* Header - Minimalist ve küçük */}
      <header className="py-4 px-6">
        <div className="container mx-auto">
          <h1 className="text-xl font-bold text-white"></h1>
        </div>
      </header>

      {/* Main Content - Sadece form */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          <FileUploadForm />
        </div>
      </main>

      {/* Footer - Çok minimal */}
      <footer className="py-3 px-6">
        <div className="container mx-auto text-center text-zinc-500 text-xs">
          <p>
            NextShare V3.1.0 &copy; {new Date().getFullYear()} 
            <button 
              onClick={() => setIsChangelogOpen(true)}
              className="ml-2 text-blue-400 hover:text-blue-300 hover:underline focus:outline-none transition"
              aria-label="View changelog"
            >
              Changelog
            </button>
          </p>
        </div>
      </footer>

      {/* Changelog Modal */}
      <ChangelogModal 
        isOpen={isChangelogOpen} 
        onClose={() => setIsChangelogOpen(false)} 
      />
    </div>
  );
}
