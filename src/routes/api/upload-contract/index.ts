import type { RequestHandler } from '@builder.io/qwik-city';
import { getSession } from '~/utils/auth';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const onPost: RequestHandler = async (requestEvent) => {
  const { json, error } = requestEvent;

  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    throw error(401, 'Unauthorized');
  }

  try {
    const formData = await requestEvent.request.formData();
    const contractFile = formData.get('contract') as File | null;

    if (!contractFile) {
      throw error(400, 'No file uploaded.');
    }
    
    if (contractFile.type !== 'application/pdf') {
        throw error(400, 'Only PDF files are allowed.');
    }

    // Generate a unique filename
    const randomSuffix = randomBytes(8).toString('hex');
    const extension = path.extname(contractFile.name) || '.pdf';
    const fileName = `${path.basename(contractFile.name, extension)}-${Date.now()}-${randomSuffix}${extension}`;

    const uploadDir = path.join(process.cwd(), 'private_uploads');
    await mkdir(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, fileName);
    
    // Convert File to Buffer and write to disk
    const buffer = Buffer.from(await contractFile.arrayBuffer());
    await writeFile(filePath, buffer);

    json(200, { success: true, fileName });

  } catch (e: any) {
    console.error('File upload error:', e);
    if (e.status) { // It's an ErrorResponse from Qwik City
        throw e;
    }
    throw error(500, 'An unexpected error occurred during file upload.');
  }
};
