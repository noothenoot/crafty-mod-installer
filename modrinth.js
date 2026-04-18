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
        // Extract slug from URL if needed
        let slug = id;
        if (id.includes('modrinth.com')) {
            const parts = id.split('/');
            slug = parts[parts.length - 1] || parts[parts.length - 2];
        }
        const resp = await this.client.get(`/project/${slug}`);
        return resp.data;
    }

    async getVersion(versionId) {
        const resp = await this.client.get(`/version/${versionId}`);
        return resp.data;
    }

    async getVersions(projectId) {
        const resp = await this.client.get(`/project/${projectId}/version`);
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

    async installMod(versionId, targetDir) {
        console.log(`Downloading Modrinth file version: ${versionId}...`);
        const version = await this.getVersion(versionId);
        
        // Find .mrpack for modpacks or the primary .jar for mods
        const packFile = version.files.find(f => f.filename.endsWith('.mrpack'));
        if (packFile) {
            return await this.installModpack(version, packFile, targetDir);
        }

        const jarFile = version.files.find(f => f.primary) || version.files[0];
        if (!jarFile) throw new Error('No files found for this version');

        const modsDir = path.join(targetDir, 'mods');
        await fs.ensureDir(modsDir);
        const destPath = path.join(modsDir, jarFile.filename);
        
        console.log(`  Downloading ${jarFile.filename}...`);
        await this.downloadFile(jarFile.url, destPath);
        console.log('✅ Mod installation complete!');
    }

    async installModpack(version, mrpackFile, targetDir) {
        const tempPath = path.join(process.cwd(), 'temp_pack.mrpack');
        await this.downloadFile(mrpackFile.url, tempPath);

        const zip = new AdmZip(tempPath);
        const indexEntry = zip.getEntry('modrinth.index.json');
        if (!indexEntry) throw new Error('Invalid .mrpack: missing modrinth.index.json');

        const index = JSON.parse(zip.readAsText(indexEntry));
        
        console.log(`Downloading ${index.files.length} mods from pack...`);
        for (const file of index.files) {
            const destPath = path.join(targetDir, file.path);
            await fs.ensureDir(path.dirname(destPath));
            console.log(`  Downloading ${path.basename(file.path)}...`);
            await this.downloadFile(file.downloads[0], destPath);
        }

        // Handle overrides
        console.log('Applying overrides...');
        const overridesDir = 'overrides';
        const zipEntries = zip.getEntries();
        zipEntries.forEach(entry => {
            if (entry.entryName.startsWith(overridesDir + '/')) {
                const relativePath = entry.entryName.substring(overridesDir.length + 1);
                if (relativePath) {
                    const dest = path.join(targetDir, relativePath);
                    if (entry.isDirectory) {
                        fs.ensureDirSync(dest);
                    } else {
                        fs.ensureDirSync(path.dirname(dest));
                        fs.writeFileSync(dest, entry.getData());
                    }
                }
            }
        });
        
        await fs.remove(tempPath);
        console.log('✅ Modpack installation complete!');
    }
}

module.exports = ModrinthHandler;
