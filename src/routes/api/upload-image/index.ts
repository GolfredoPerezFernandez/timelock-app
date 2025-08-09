import type { RequestHandler } from '@builder.io/qwik-city';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';

export const onPost: RequestHandler = async (event) => {
  const formData = await event.request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    event.json(400, { error: 'No file uploaded' });
    return;
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = file.type.split('/')[1] || 'jpg';
  const fileName = `tree-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const uploadPath = join(process.cwd(), 'public', 'uploads', fileName);
  await writeFile(uploadPath, buffer);
  event.json(200, { url: `/uploads/${fileName}` });
};
