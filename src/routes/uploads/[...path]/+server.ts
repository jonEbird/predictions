import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export const GET: RequestHandler = async ({ params }) => {
	const filepath = params.path;

	if (!filepath) {
		throw error(404, 'File not found');
	}

	// Security: prevent directory traversal
	const fullPath = path.join(UPLOADS_DIR, filepath);
	if (!fullPath.startsWith(UPLOADS_DIR)) {
		throw error(403, 'Access denied');
	}

	// Check if file exists
	if (!fs.existsSync(fullPath)) {
		throw error(404, 'File not found');
	}

	// Read file
	const file = fs.readFileSync(fullPath);

	// Determine content type based on extension
	const ext = path.extname(filepath).toLowerCase();
	const contentTypes: Record<string, string> = {
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.svg': 'image/svg+xml'
	};

	const contentType = contentTypes[ext] || 'application/octet-stream';

	return new Response(file, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
