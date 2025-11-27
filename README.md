# file-download-server

A Node.js file download server with admin management and GitHub integration.

## Features

### Admin Features
- Add/delete download links
- Create/manage categories
- Authentication with secret key
- JSON data management via GitHub
- Download statistics

### Client Features
- Browse available downloads
- Filter by categories
- Secure file downloads
- Real-time file listing

## API Endpoints

### Public Endpoints
- `GET /` - Health check and API documentation
- `GET /api/files` - Get all available files
- `GET /api/categories` - Get all categories
- `GET /api/download/:id` - Download file by ID

### Admin Endpoints (require authentication)
- `POST /api/admin/files` - Add new file
- `DELETE /api/admin/files/:id` - Delete file
- `POST /api/admin/categories` - Add category
- `DELETE /api/admin/categories/:id` - Delete category
- `POST /api/admin/stats` - Get admin statistics

## Setup

### 1. GitHub Repository Setup
1. Create a new repository named `mynote`
2. Generate a personal access token with repo permissions
3. The server will automatically create `files.json` and `categories.json`

### 2. Local Development
```bash
npm install
npm run dev
```

### 3. Vercel Deployment
1. Import your GitHub repository to Vercel
2. Add the following environment variables:
   - `GITHUB_TOKEN` - Your GitHub personal access token
   - `ADMIN_SECRET` - Admin authentication secret
   - `GITHUB_OWNER` - Repository owner username
   - `GITHUB_REPO` - Repository name for data storage

## Authentication

Admin endpoints require authentication via:
- Request body: `{"secret": "your-admin-secret"}`
- Authorization header: `Bearer your-admin-secret`

## Data Storage

The server uses GitHub repository files for data storage:
- `files.json` - Stores file metadata
- `categories.json` - Stores category information

## Usage Examples

### Add a file (Admin)
```javascript
fetch('/api/admin/files', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-admin-secret'
  },
  body: JSON.stringify({
    name: 'Example File',
    url: 'https://example.com/file.zip',
    category: 'Software',
    description: 'An example file',
    size: '10MB'
  })
});
```

### Get files (Public)
```javascript
fetch('/api/files')
  .then(res => res.json())
  .then(data => console.log(data.files));
```

### Download file (Public)
```javascript
// Direct download via redirect
window.open('/api/download/file-id', '_blank');
```

## License

MIT License
