import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import * as crypto from 'crypto';

export const dynamic = 'force-dynamic';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nextshare-encryption-key-secure-very-long';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + ENCRYPTION_KEY).digest('hex');
}

async function streamFile(filePath: string, fileName: string) {
  const fileStats = await stat(filePath);
  const fileStream = createReadStream(filePath);

  const stream = new ReadableStream({
    start(controller) {
      fileStream.on('data', (chunk) => controller.enqueue(chunk));
      fileStream.on('end', () => controller.close());
      fileStream.on('error', (err) => controller.error(err));
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileStats.size.toString(),
    },
    status: 200,
  });
}

// GET handler for direct downloads (unencrypted or with password in query)
export async function GET(request: NextRequest, props: { params: Promise<{ fileId: string }> }) {
  const params = await props.params;
  try {
    const { fileId } = params;
    const password = request.nextUrl.searchParams.get('password');

    const fileDir = join(UPLOADS_DIR, fileId);
    const metaPath = join(fileDir, 'meta.json');

    if (!existsSync(metaPath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));

    if (meta.expiresAt < Date.now()) {
      return new NextResponse('File has expired', { status: 410 });
    }

    if (meta.isEncrypted) {
      if (!password) {
        return new NextResponse('Password required', { status: 401 });
      }
      if (hashPassword(password) !== meta.passwordHash) {
        return new NextResponse('Invalid password', { status: 403 });
      }
    }

    const finalPath = join(fileDir, meta.fileName);
    if (!existsSync(finalPath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    return await streamFile(finalPath, meta.fileName);

  } catch (error) {
    console.error('File download error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}

// POST handler for password validation
export async function POST(request: NextRequest, props: { params: Promise<{ fileId: string }> }) {
  const params = await props.params;
  try {
    const { fileId } = params;
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 });
    }

    const fileDir = join(UPLOADS_DIR, fileId);
    const metaPath = join(fileDir, 'meta.json');

    if (!existsSync(metaPath)) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));

    if (meta.expiresAt < Date.now()) {
      return NextResponse.json({ success: false, error: 'File has expired' }, { status: 410 });
    }

    if (!meta.isEncrypted) {
      return NextResponse.json({ success: true }); // No password needed
    }

    if (hashPassword(password) === meta.passwordHash) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 403 });
    }

  } catch (error) {
    console.error('Password validation error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
 