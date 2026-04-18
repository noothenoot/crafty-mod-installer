const axios = require('axios');

class CraftyClient {
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
        this.client = axios.create({
            baseURL: `${this.baseUrl}/api/v2`,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async testConnection() {
        try {
            const resp = await this.client.get('/stats');
            return resp.status === 200;
        } catch (err) {
            console.error('Crafty Connection Error:', err.message);
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
}

module.exports = CraftyClient;
