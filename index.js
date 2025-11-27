const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Chijioke12';
const GITHUB_REPO = process.env.GITHUB_REPO || 'mynote';

// GitHub API configuration
const githubApi = {
    baseURL: 'https://api.github.com',
    headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    }
};

// Utility functions
async function getFileFromGitHub(filename) {
    try {
        const response = await axios.get(
            `${githubApi.baseURL}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`,
            { headers: githubApi.headers }
        );
        return JSON.parse(Buffer.from(response.data.content, 'base64').toString());
    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
}

async function saveFileToGitHub(filename, data, sha = null) {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const payload = {
        message: `Update ${filename}`,
        content: content
    };
    
    if (sha) {
        payload.sha = sha;
    }

    await axios.put(
        `${githubApi.baseURL}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`,
        payload,
        { headers: githubApi.headers }
    );
}

async function getFileSha(filename) {
    try {
        const response = await axios.get(
            `${githubApi.baseURL}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`,
            { headers: githubApi.headers }
        );
        return response.data.sha;
    } catch (error) {
        return null;
    }
}

// Authentication middleware for admin routes
function authenticateAdmin(req, res, next) {
    const { secret } = req.body || {};
    const authHeader = req.headers.authorization;
    
    let providedSecret = secret;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        providedSecret = authHeader.substring(7);
    }
    
    if (!providedSecret || providedSecret !== ADMIN_SECRET) {
        return res.status(401).json({ 
            success: false, 
            message: 'Unauthorized: Invalid admin secret' 
        });
    }
    
    next();
}

// Routes

// Health check
app.get('/', (req, res) => {
    res.json({
        message: 'file-download-server is running',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        endpoints: {
            'GET /api/files': 'Get all available files',
            'GET /api/categories': 'Get all categories',
            'POST /api/admin/files': 'Add new file (admin)',
            'DELETE /api/admin/files/:id': 'Delete file (admin)',
            'POST /api/admin/categories': 'Add category (admin)',
            'DELETE /api/admin/categories/:id': 'Delete category (admin)',
            'GET /api/download/:id': 'Download file by ID'
        }
    });
});

// Get all files (public)
app.get('/api/files', async (req, res) => {
    try {
        const files = await getFileFromGitHub('files.json') || [];
        res.json({
            success: true,
            files: files.map(file => ({
                id: file.id,
                name: file.name,
                category: file.category,
                description: file.description,
                size: file.size,
                uploadDate: file.uploadDate,
                downloadCount: file.downloadCount || 0
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching files',
            error: error.message
        });
    }
});

// Get all categories (public)
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await getFileFromGitHub('categories.json') || [];
        res.json({
            success: true,
            categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching categories',
            error: error.message
        });
    }
});

// Download file
app.get('/api/download/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const files = await getFileFromGitHub('files.json') || [];
        const file = files.find(f => f.id === id);
        
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }
        
        // Increment download count
        file.downloadCount = (file.downloadCount || 0) + 1;
        file.lastDownloaded = new Date().toISOString();
        
        const sha = await getFileSha('files.json');
        await saveFileToGitHub('files.json', files, sha);
        
        // Redirect to actual file URL
        res.redirect(file.url);
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error downloading file',
            error: error.message
        });
    }
});

// Admin Routes

// Add new file (admin only)
app.post('/api/admin/files', authenticateAdmin, async (req, res) => {
    try {
        const { name, url, category, description, size } = req.body;
        
        if (!name || !url) {
            return res.status(400).json({
                success: false,
                message: 'Name and URL are required'
            });
        }
        
        const files = await getFileFromGitHub('files.json') || [];
        const newFile = {
            id: uuidv4(),
            name,
            url,
            category: category || 'Uncategorized',
            description: description || '',
            size: size || 'Unknown',
            uploadDate: new Date().toISOString(),
            downloadCount: 0
        };
        
        files.push(newFile);
        
        const sha = await getFileSha('files.json');
        await saveFileToGitHub('files.json', files, sha);
        
        res.json({
            success: true,
            message: 'File added successfully',
            file: newFile
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding file',
            error: error.message
        });
    }
});

// Delete file (admin only)
app.delete('/api/admin/files/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const files = await getFileFromGitHub('files.json') || [];
        const fileIndex = files.findIndex(f => f.id === id);
        
        if (fileIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }
        
        const deletedFile = files.splice(fileIndex, 1)[0];
        
        const sha = await getFileSha('files.json');
        await saveFileToGitHub('files.json', files, sha);
        
        res.json({
            success: true,
            message: 'File deleted successfully',
            deletedFile
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting file',
            error: error.message
        });
    }
});

// Add category (admin only)
app.post('/api/admin/categories', authenticateAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }
        
        const categories = await getFileFromGitHub('categories.json') || [];
        const existingCategory = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
        
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category already exists'
            });
        }
        
        const newCategory = {
            id: uuidv4(),
            name,
            description: description || '',
            createdDate: new Date().toISOString()
        };
        
        categories.push(newCategory);
        
        const sha = await getFileSha('categories.json');
        await saveFileToGitHub('categories.json', categories, sha);
        
        res.json({
            success: true,
            message: 'Category added successfully',
            category: newCategory
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding category',
            error: error.message
        });
    }
});

// Delete category (admin only)
app.delete('/api/admin/categories/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const categories = await getFileFromGitHub('categories.json') || [];
        const categoryIndex = categories.findIndex(c => c.id === id);
        
        if (categoryIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        const deletedCategory = categories.splice(categoryIndex, 1)[0];
        
        const sha = await getFileSha('categories.json');
        await saveFileToGitHub('categories.json', categories, sha);
        
        res.json({
            success: true,
            message: 'Category deleted successfully',
            deletedCategory
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting category',
            error: error.message
        });
    }
});

// Get admin stats (admin only)
app.post('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const files = await getFileFromGitHub('files.json') || [];
        const categories = await getFileFromGitHub('categories.json') || [];
        
        const totalDownloads = files.reduce((sum, file) => sum + (file.downloadCount || 0), 0);
        const categoryStats = categories.map(category => ({
            name: category.name,
            fileCount: files.filter(f => f.category === category.name).length
        }));
        
        res.json({
            success: true,
            stats: {
                totalFiles: files.length,
                totalCategories: categories.length,
                totalDownloads,
                categoryStats,
                recentFiles: files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)).slice(0, 5)
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stats',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Handle 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            'GET /',
            'GET /api/files',
            'GET /api/categories',
            'GET /api/download/:id',
            'POST /api/admin/files',
            'DELETE /api/admin/files/:id',
            'POST /api/admin/categories',
            'DELETE /api/admin/categories/:id',
            'POST /api/admin/stats'
        ]
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 GitHub Repo: ${GITHUB_OWNER}/${GITHUB_REPO}`);
});

module.exports = app;