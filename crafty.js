const axios = require('axios');
const https = require('https');
const FormData = require('form-data');
const crypto = require('crypto');
const fs = require('fs-extra');
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

    async listFiles(serverId, remotePath = 'mods') {
        try {
            const targetPath = remotePath.replace(/^\//, '');
            // In Crafty 4, file listing is often just GET /servers/{id}/files
            // or /servers/{id}/files/list. We'll try the most standard one first.
            const resp = await this.client.get(`/servers/${serverId}/files?path=${encodeURIComponent(targetPath)}`);
            return resp.data.data || [];
        } catch (err) {
            // Fallback for different Crafty versions
            try {
                const resp = await this.client.get(`/servers/${serverId}/files/list?path=${encodeURIComponent(remotePath)}`);
                return resp.data.data || [];
            } catch (e) {
                return [];
            }
        }
    }

    async createServer(name, serverType = 'paper', memory = 2048, port = 25565, version = '1.20.1') {
        const memGB = Math.floor(memory / 1024) || 1;
        const payload = {
            "name": name,
            "monitoring_type": "minecraft_java",
            "minecraft_java_monitoring_data": {
                "host": "127.0.0.1",
                "port": port
            },
            "create_type": "minecraft_java",
            "minecraft_java_create_data": {
                "create_type": "download_jar",
                "download_jar_create_data": {
                    "category": "mc_java_servers",
                    "type": serverType,
                    "version": version,
                    "mem_min": memGB,
                    "mem_max": memGB,
                    "server_properties_port": port
                }
            }
        };
        const resp = await this.client.post('/servers', payload);
        const data = resp.data.data;
        
        // Handle variations in ID property name
        if (data && !data.server_id) {
            data.server_id = data.new_server_id || data.id || data.serverID || data.uuid;
        }
        
        return data;
    }

    async installServer(serverId) {
        const resp = await this.client.post(`/servers/${serverId}/install`);
        return resp.data;
    }

    async runAction(serverId, action) {
        // Common actions: start_server, stop_server, restart_server, kill_server
        const resp = await this.client.post(`/servers/${serverId}/action/${action}`);
        return resp.data;
    }

    async getServerStatus(serverId) {
        const resp = await this.client.get(`/servers/${serverId}`);
        return resp.data.data;
    }

    async createRemoteFile(serverId, fileName, content, remotePath = '') {
        const tempPath = path.join(process.cwd(), `temp_${fileName}`);
        await fs.writeFile(tempPath, content);
        try {
            await this.uploadFile(serverId, tempPath, remotePath);
        } finally {
            await fs.remove(tempPath);
        }
    }

    async ensureDirectory(serverId, remotePath) {
        try {
            const targetPath = remotePath.replace(/^\//, '');
            // Attempt to create folder using both common endpoints
            await this.client.post(`/servers/${serverId}/files/folder`, { path: targetPath }).catch(() => {
                return this.client.post(`/servers/${serverId}/files`, { action: 'mkdir', path: targetPath });
            });
        } catch (err) {
            // Ignore errors if directory already exists
        }
    }

    async uploadFile(serverId, localFilePath, remotePath = 'mods') {
        const stats = fs.statSync(localFilePath);
        const fileName = path.basename(localFilePath);
        const fileId = Math.random().toString(36).substring(2, 15);
        const targetLocation = remotePath.replace(/^\//, '');

        await this.ensureDirectory(serverId, targetLocation);

        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
        const totalChunks = Math.ceil(stats.size / CHUNK_SIZE);

        console.log(`  Syncing ${fileName} to Crafty (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

        if (stats.size > CHUNK_SIZE) {
            console.log(`  [Chunked Upload] Splitting into ${totalChunks} parts...`);
            
            // Initial handshake request (no chunkId)
            await this.client.post(`/servers/${serverId}/files/upload`, null, {
                headers: {
                    'chunked': 'true',
                    'fileId': fileId,
                    'fileName': fileName,
                    'fileSize': stats.size.toString(),
                    'totalChunks': totalChunks.toString(),
                    'location': targetLocation
                }
            });

            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, stats.size);
                const chunkBody = await this.readChunk(localFilePath, start, end);
                
                // Calculate SHA-256 hash of the chunk
                const hash = crypto.createHash('sha256').update(chunkBody).digest('hex');

                process.stdout.write(`    Uploading part ${i + 1}/${totalChunks}... `);
                await this.client.post(`/servers/${serverId}/files/upload`, chunkBody, {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'location': targetLocation,
                        'fileName': fileName,
                        'fileSize': stats.size.toString(),
                        'fileId': fileId,
                        'chunked': 'true',
                        'chunkId': i.toString(),
                        'totalChunks': totalChunks.toString(),
                        'chunkHash': hash
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
                console.log('✅');
            }
        } else {
            // Small file - single upload
            await this.client.post(`/servers/${serverId}/files/upload`, fs.createReadStream(localFilePath), {
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
        }
        return { status: 'ok' };
    }

    async readChunk(filePath, start, end) {
        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(filePath, { start, end: end - 1 });
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', (err) => reject(err));
        });
    }
}

module.exports = CraftyClient;
