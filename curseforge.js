const { CurseForgeClient } = require('curseforge-api');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');

class CurseForgeHandler {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.client = new CurseForgeClient(apiKey);
    }

    async getMod(id) {
        // identifier can be numeric ID or slug (though the library might need specific search for slug)
        if (isNaN(id)) {
            const results = await this.client.searchMods({ slug: id });
            if (results.data.length === 0) throw new Error('Mod not found');
            return results.data[0];
        }
        return await this.client.getMod(id);
    }

    async getFiles(id) {
        const results = await this.client.getModFiles(id);
        return results.data;
    }

    async downloadFile(url, targetPath) {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: { 'x-api-key': this.apiKey }
        });
        const writer = fs.createWriteStream(targetPath);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    async installModpack(modId, fileId, targetDir) {
        console.log(`Downloading CurseForge pack (Mod: ${modId}, File: ${fileId})...`);
        
        const file = await this.client.getModFile(modId, fileId);
        if (!file.downloadUrl) throw new Error('Download URL not found for this file.');
        
        const tempPath = path.join(process.cwd(), 'temp_pack.zip');
        await this.downloadFile(file.downloadUrl, tempPath);

        const zip = new AdmZip(tempPath);
        const manifestEntry = zip.getEntry('manifest.json');
        if (!manifestEntry) throw new Error('Invalid CurseForge pack: missing manifest.json');

        const manifest = JSON.parse(zip.readAsText(manifestEntry));
        const modsDir = path.join(targetDir, 'mods');
        await fs.ensureDir(modsDir);

        console.log(`Downloading ${manifest.files.length} mods from CurseForge...`);
        for (const fileInfo of manifest.files) {
            const modFile = await this.client.getModFile(fileInfo.projectID, fileInfo.fileID);
            const destPath = path.join(modsDir, modFile.fileName);
            console.log(`  Downloading ${modFile.fileName}...`);
            await this.downloadFile(modFile.downloadUrl, destPath);
        }

        // Handle overrides
        const overridesEntry = zip.getEntry('overrides/');
        if (overridesEntry) {
            console.log('Applying overrides...');
            zip.extractAllTo(targetDir, true);
        }
        
        await fs.remove(tempPath);
        console.log('CurseForge installation complete!');
    }
}

module.exports = CurseForgeHandler;
