# NextShare - Secure File Sharing Platform

NextShare is a modern, secure, and user-friendly file sharing platform built with Next.js. It allows users to share files with end-to-end encryption and automatic file expiry for enhanced privacy and security.

## Features

### Core Functionality
- **Simple File Sharing**: Upload and share files with a unique link
- **Automatic File Expiry**: Files automatically expire after a set duration (1-24 hours)
- **End-to-End Encryption**: Optional password protection with client-side encryption
- **Direct Download Links**: API endpoints for direct file downloads
- **Chunked Uploads**: Support for large file uploads with chunk processing

### User Experience
- **Modern UI**: Clean, responsive design with smooth animations
- **Drag & Drop**: Intuitive file upload with drag and drop support
- **Recent Uploads**: Quick access to your recently shared files
- **Mobile-Friendly**: Fully responsive design works on all devices
- **Progress Tracking**: Real-time progress indicators for uploads

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Storage**: Server-side file storage with expiry management
- **Security**: AES-256 encryption for secure file storage

## Getting Started

### Prerequisites

- Node.js 16.x or later
- npm or yarn package manager

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/nextshare.git
   cd nextshare
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:5010](http://localhost:5010) in your browser to see the application.

## Usage

### Sharing Files

1. Drag & drop a file or click to select a file
2. Choose how long the file should be available (1-24 hours)
3. Optional: Enable encryption and set a 4-digit password
4. Click "Generate Link" to upload the file
5. Share the generated link with recipients

### Accessing Shared Files

1. Open the shared link in a browser
2. If the file is encrypted, enter the 4-digit password
3. Download the file directly

### Using the Recent Uploads Feature

- Recently uploaded files appear in the sidebar for quick access
- Click the link icon to copy the file's share link
- Click the X to remove an item from the list

## Development

### Project Structure

```
/src
  /app              # Next.js app directory
    /api            # API endpoints
    /[fileId]       # File download page
  /components       # React components
  /lib              # Utility functions
/uploads            # File storage
/temp_uploads       # Temporary storage during uploads
```

### API Endpoints

- `POST /api/upload` - Upload file chunks
- `GET /api/download/[fileId]` - Direct file download
- `GET /api/file-info/[fileId]` - Get file metadata
- `POST /api/cleanup/expired` - Clean expired files
- `DELETE /api/cleanup/temp` - Clean temporary files

## Changelog

### Version 3.0.1 (Current)
- Added Recent Uploads widget
- Improved file card design
- Added encrypted file indication with lock icon
- Quick copy link feature 
- Added direct API download links for faster downloads
- Changed default file retention period to 24 hours

### Version 3.0.0
- Complete redesign with modern UI
- Added file encryption support
- Improved file uploading with chunking
- Auto file deletion after expiry
- Mobile-friendly interface 