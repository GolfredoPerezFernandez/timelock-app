import type { RequestHandler } from '@builder.io/qwik-city';
import path from 'path';
import fs from 'fs';
import { getSession } from '~/utils/auth';

const uploadDir = path.join(process.cwd(), 'private_uploads');

export const onGet: RequestHandler = async (requestEvent) => {
  const { params, redirect, headers, error } = requestEvent;

  // 1. Check for authentication
  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    // For API endpoints, returning a 401/403 might be better
    // but for a direct browser access, redirect is fine.
    throw redirect(303, '/auth');
  }

  // 2. Get and sanitize filename to prevent path traversal attacks
  const fileName = params.fileName;
  if (!fileName || fileName.includes('..') || fileName.includes('/')) {
    throw error(400, 'Invalid filename');
  }

  const filePath = path.join(uploadDir, fileName);

  // 3. Check if file exists securely
  try {
    await fs.promises.access(filePath);
  } catch {
    throw error(404, 'File not found');
  }

  // 4. Read and serve the file
  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Content-Disposition', `inline; filename="${fileName}"`); // 'inline' suggests opening in browser

    requestEvent.send(new Response(fileBuffer));
    return;
  } catch (e) {
    console.error('Failed to read file:', e);
    throw error(500, 'Could not read file');
  }
};
