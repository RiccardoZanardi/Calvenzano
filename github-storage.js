/**
 * GitHub Storage Module
 * Provides persistent data storage using GitHub repository as backend
 * Compatible with Render free plan - no external database required
 * 
 * This module handles:
 * - Reading data from GitHub repository
 * - Writing data to GitHub repository via API
 * - Fallback to local file system when GitHub is unavailable
 * - Environment variable management for credentials
 */

const fs = require('fs');
const path = require('path');

class GitHubStorage {
    constructor() {
        // GitHub configuration from environment variables
        this.owner = process.env.GITHUB_OWNER; // GitHub username
        this.repo = process.env.GITHUB_REPO;   // Repository name
        this.token = process.env.GITHUB_TOKEN; // Personal access token
        this.branch = process.env.GITHUB_BRANCH || 'main';
        this.filePath = 'data.json'; // File path in repository
        
        // Local fallback file
        this.localFile = path.join(__dirname, 'data.json');
        
        // GitHub API base URL
        this.apiBase = 'https://api.github.com';
        
        // Validate configuration
        this.isConfigured = !!(this.owner && this.repo && this.token);
        
        if (!this.isConfigured) {
            console.warn('GitHub storage not configured. Using local file fallback.');
            console.warn('Set GITHUB_OWNER, GITHUB_REPO, and GITHUB_TOKEN environment variables for persistent storage.');
        }
    }
    
    /**
     * Read data from GitHub repository
     * Falls back to local file if GitHub is unavailable
     */
    async readData() {
        if (!this.isConfigured) {
            return this.readLocalData();
        }
        
        try {
            const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${this.filePath}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Multe-App'
                }
            });
            
            if (response.status === 404) {
                // File doesn't exist in repository, create with default data
                console.log('Data file not found in GitHub repository. Creating with default data.');
                const defaultData = this.getDefaultData();
                await this.writeData(defaultData);
                return defaultData;
            }
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            
            const fileData = await response.json();
            const content = Buffer.from(fileData.content, 'base64').toString('utf8');
            const data = JSON.parse(content);
            
            // Store SHA for future updates
            this.currentSha = fileData.sha;
            
            // Also save to local file as backup
            this.writeLocalData(data);
            
            console.log('Data successfully loaded from GitHub repository.');
            return data;
            
        } catch (error) {
            console.error('Error reading from GitHub:', error.message);
            console.log('Falling back to local file.');
            return this.readLocalData();
        }
    }
    
    /**
     * Write data to GitHub repository
     * Falls back to local file if GitHub is unavailable
     */
    async writeData(data) {
        // Always save to local file first as backup
        this.writeLocalData(data);
        
        if (!this.isConfigured) {
            console.log('Data saved to local file (GitHub not configured).');
            return true;
        }
        
        try {
            const content = JSON.stringify(data, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');
            
            const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${this.filePath}`;
            
            const payload = {
                message: `Update data.json - ${new Date().toISOString()}`,
                content: encodedContent,
                branch: this.branch
            };
            
            // Include SHA if we have it (for updates)
            if (this.currentSha) {
                payload.sha = this.currentSha;
            }
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Multe-App'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API error: ${response.status} - ${errorData.message}`);
            }
            
            const result = await response.json();
            this.currentSha = result.content.sha;
            
            console.log('Data successfully saved to GitHub repository.');
            return true;
            
        } catch (error) {
            console.error('Error writing to GitHub:', error.message);
            console.log('Data saved to local file only.');
            return false;
        }
    }
    
    /**
     * Read data from local file
     */
    readLocalData() {
        try {
            if (fs.existsSync(this.localFile)) {
                const content = fs.readFileSync(this.localFile, 'utf8');
                return JSON.parse(content);
            } else {
                const defaultData = this.getDefaultData();
                this.writeLocalData(defaultData);
                return defaultData;
            }
        } catch (error) {
            console.error('Error reading local file:', error.message);
            return this.getDefaultData();
        }
    }
    
    /**
     * Write data to local file
     */
    writeLocalData(data) {
        try {
            fs.writeFileSync(this.localFile, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error writing local file:', error.message);
            return false;
        }
    }
    
    /**
     * Get default data structure
     */
    getDefaultData() {
        return {
            members: [],
            categories: {},
            lastUpdated: new Date().toISOString()
        };
    }
    
    /**
     * Check if GitHub storage is properly configured
     */
    isGitHubConfigured() {
        return this.isConfigured;
    }
    
    /**
     * Get storage status information
     */
    getStorageInfo() {
        return {
            githubConfigured: this.isConfigured,
            owner: this.owner,
            repo: this.repo,
            branch: this.branch,
            localFile: this.localFile
        };
    }
}

module.exports = GitHubStorage;