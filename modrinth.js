const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');

class ModrinthHandler {
    constructor() {
        this.client = axios.create({
            baseURL: 'https://api.modrinth.com/v2',
            headers: { 'User-Agent': 'CraftyModInstaller/1.0.0' }
        });
    }

    async getProject(id) {
        const resp = await this.client.get(`/project/${id}`);
        return resp.data;
    }

    async getVersion(versionId) {
        const resp = await this.client.get(`/version/${versionId}`);
        return resp.data;
    }

    async downloadFile(url, targetPath) {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });
        const writer = fs.createWriteStream(targetPath);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    async installModpack(versionId, targetDir) {
        console.log(`Downloading Modrinth pack version: ${versionId}...`);
        const version = await this.getVersion(versionId);
        const mrpackFile = version.files.find(f => f.filename.endsWith('.mrpack'));
        
        if (!mrpackFile) throw new Error('No .mrpack file found in this version');

        const tempPath = path.join(process.cwd(), 'temp_pack.mrpack');
        await this.downloadFile(mrpackFile.url, tempPath);

        const zip = new AdmZip(tempPath);
        const indexEntry = zip.getEntry('modrinth.index.json');
        if (!indexEntry) throw new Error('Invalid .mrpack: missing modrinth.index.json');

        const index = JSON.parse(zip.readAsText(indexEntry));
        
        // Ensure mods directory exists
        const modsDir = path.join(targetDir, 'mods');
        await fs.ensureDir(modsDir);

        console.log(`Downloading ${index.files.length} mods...`);
        for (const file of index.files) {
            const destPath = path.join(targetDir, file.path);
            await fs.ensureDir(path.dirname(destPath));
            console.log(`  Downloading ${path.basename(file.path)}...`);
            await this.downloadFile(file.downloads[0], destPath);
        }

        // Handle overrides
        console.log('Applying overrides...');
        zip.extractAllTo(targetDir, true); // This is a simplification; should only extract 'overrides' folder
        // TODO: Properly merge overrides folder contents into root
        
        await fs.remove(tempPath);
        console.log('Modpack installation complete!');
    }
}

module.exports = ModrinthHandler;
