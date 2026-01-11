# Uploads Directory

This directory contains user-uploaded content that is served at runtime via `/uploads/*` routes.

## Structure

- `mugshots/` - User profile pictures
- `prizes/` - Prize images for groups (e.g., coffee cup)
- `groups/` - Group logos/pictures

## Adding Files

Files placed here will be accessible at:
- `/uploads/mugshots/filename.jpg`
- `/uploads/prizes/filename.jpg`
- `/uploads/groups/filename.jpg`

## User Mugshots

Current mugshot files needed (from database):
- jon.jpg
- cherina.jpg
- mike.jpg
- todd.jpg
- patrick.jpg
- (and others)

Copy your existing mugshot images to `uploads/mugshots/` to make them visible in the app.

## Group Pictures

If you have a logo or picture for the "Bucknuts" group:

1. Place the image in `uploads/groups/` (e.g., `bucknuts.jpg`)
2. Update the database:
   ```bash
   sqlite3 predictions.db "UPDATE groups SET picture_url = '/uploads/groups/bucknuts.jpg' WHERE slug = 'bucknuts';"
   ```

The group picture appears:
- On the group detail page (top right, 96x96px)
- On the groups list page (full width, 128px height)

## Security

The upload route handler (`src/routes/uploads/[...path]/+server.ts`) includes:
- Path traversal protection
- Content-type detection
- Proper caching headers

## Future: File Upload Feature

When implementing user upload functionality, files should be saved to these directories and the database updated with the `/uploads/{category}/filename` path.
