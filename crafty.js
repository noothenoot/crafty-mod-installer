const axios = require('axios');
const https = require('https');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class CraftyClient {
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
        this.client = axios.create({
            baseURL: `${this.baseUrl}/api/v2`,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            httpsAgent: new https.Agent({  
                rejectUnauthorized: false
            })
        });
    }

    async testConnection() {
        try {
            const resp = await this.client.get('/servers');
            return resp.status === 200;
        } catch (err) {
            if (err.response) {
                console.error(`Crafty Connection Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            } else if (err.request) {
                console.error(`Crafty Connection Error: No response received. Check if your CRAFTY_URL is correct and reachable.`);
            } else {
                console.error('Crafty Connection Error:', err.message);
            }
            return false;
        }
    }

    async listServers() {
        const resp = await this.client.get('/servers');
        return resp.data.data;
    }

    async getServerDetails(serverId) {
        const resp = await this.client.get(`/servers/${serverId}`);
        return resp.data.data;
    }

    async createServer(name, type = 'minecraft_java', memory = 2048, port = 25565) {
        const payload = {
            server_name: name,
            server_type: type,
            mem_limit: memory,
            server_port: port,
            autostart: false
        };
        const resp = await this.client.post('/servers', payload);
        return resp.data.data;
    }

    async uploadFile(serverId, localFilePath, remotePath = 'mods') {
        const stats = fs.statSync(localFilePath);
        const fileName = path.basename(localFilePath);
        const fileId = Math.random().toString(36).substring(2, 15);
        
        // Remove leading slash for 'location' header
        const targetLocation = remotePath.replace(/^\//, '');

        console.log(`  Sending raw binary to Crafty (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

        const resp = await this.client.post(`/servers/${serverId}/files/upload`, fs.createReadStream(localFilePath), {
            headers: {
                'Content-Type': 'application/octet-stream',
                'location': targetLocation,
                'fileName': fileName,
                'fileSize': stats.size.toString(),
                'fileId': fileId
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        return resp.data;
    }
}

module.exports = CraftyClient;
