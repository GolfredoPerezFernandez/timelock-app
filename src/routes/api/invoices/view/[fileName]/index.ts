import { type RequestHandler } from '@builder.io/qwik-city';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSession } from '~/utils/auth';

const UPLOAD_DIR = join(process.cwd(), 'private_uploads');

export const onGet: RequestHandler = async (requestEvent) => {
  const { params, error, headers, redirect } = requestEvent;

  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    throw redirect(303, '/auth');
  }

  try {
    const fileName = params.fileName;
    // Basic security check to prevent directory traversal
    if (!fileName || fileName.includes('..') || fileName.includes('/')) {
      console.error(`[VIEW-INVOICE] Invalid file name: ${fileName}`);
      throw error(400, 'Invalid file name');
    }

    const filePath = join(UPLOAD_DIR, fileName);
    console.log(`[VIEW-INVOICE] Attempting to read file: ${filePath}`);
    // Check if file exists
    try {
      await readFile(filePath);
    } catch {
      throw error(404, 'File not found');
    }

    const fileBuffer = await readFile(filePath);
    console.log(`[VIEW-INVOICE] File read OK: ${filePath} (size: ${fileBuffer.length})`);

    // Always serve as PDF for .pdf files
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Content-Disposition', `inline; filename="${fileName}"`);

  requestEvent.send(new Response(new Uint8Array(fileBuffer)));
    return;
  } catch (e) {
    console.error('File serving failed:', e);
    throw error(404, 'File not found');
  }
};
