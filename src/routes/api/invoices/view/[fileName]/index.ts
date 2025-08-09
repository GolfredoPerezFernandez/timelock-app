import { type RequestHandler } from '@builder.io/qwik-city';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSession } from '~/utils/auth';

const UPLOAD_DIR = join(process.cwd(), 'private_uploads', 'invoices');

export const onGet: RequestHandler = async (requestEvent) => {
  const { params, error, headers } = requestEvent;

  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    throw error(401, 'Unauthorized');
  }

  try {
    const fileName = params.fileName;
    // Basic security check to prevent directory traversal
    if (fileName.includes('..') || fileName.includes('/')) {
        throw error(400, 'Invalid file name');
    }

    const filePath = join(UPLOAD_DIR, fileName);
    const fileBuffer = await readFile(filePath);

    // Determine content type from file extension
    const extension = fileName.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    if (extension === 'pdf') {
        contentType = 'application/pdf';
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension || '')) {
        contentType = `image/${extension}`;
    }

    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    // Use 'inline' to display in browser, 'attachment' to force download
    headers.set('Content-Disposition', `inline; filename="${fileName}"`);

    requestEvent.send(fileBuffer);

  } catch (e) {
    console.error('File serving failed:', e);
    throw error(404, 'File not found');
  }
};
