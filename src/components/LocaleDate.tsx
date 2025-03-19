"use client";

import { useState, useEffect } from 'react';

interface LocaleDateProps {
  timestamp: number;
}

export default function LocaleDate({ timestamp }: LocaleDateProps) {
  const [formattedDate, setFormattedDate] = useState<string>('');
  
  useEffect(() => {
    // Format the date based on the user's local timezone when running in the browser
    const date = new Date(timestamp);
    const formatted = date.toLocaleString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    setFormattedDate(formatted);
  }, [timestamp]);
  
  // Show a loading text until rendered on the browser side
  if (!formattedDate) {
    return <span className="text-zinc-200">Loading...</span>;
  }
  
  return <span className="text-zinc-200">{formattedDate}</span>;
} 