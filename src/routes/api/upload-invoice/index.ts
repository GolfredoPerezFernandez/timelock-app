import {  type RequestHandler } from '@builder.io/qwik-city';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { getSession } from '~/utils/auth';

const UPLOAD_DIR = join(process.cwd(), 'private_uploads', 'invoices');

export const onPost: RequestHandler = async (requestEvent) => {
  const { request, error, json } = requestEvent;

  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    // Return a JSON error, don't throw
    json(401, { success: false, error: 'Unauthorized' });
    return;
  }

  try {
    // Ensure the upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      json(400, { success: false, error: 'File not provided' });
      return;
    }

    // Basic validation
    if (!file.type.startsWith('application/pdf') && !file.type.startsWith('image/')) {
      json(400, { success: false, error: 'Invalid file type. Only PDF and images are allowed.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      json(400, { success: false, error: 'File is too large. Max size is 10MB.' });
      return;
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    const extension = file.name.split('.').pop() || 'file';
    const newFileName = `invoice-${uniqueSuffix}.${extension}`;
    const filePath = join(UPLOAD_DIR, newFileName);

    await writeFile(filePath, fileBuffer);

    // Use json() to send response, consistent with contracts endpoint
    json(200, { success: true, fileName: newFileName });
    return;

  } catch (e: any) {
    console.error('File upload failed:', e);
    // Always return a JSON error response
    json(500, { success: false, error: `Upload failed: ${e.message || 'Unknown error'}` });
    return;
  }
};
