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
        // Extract ID/slug from URL if needed
        let identifier = id;
        if (id.includes('curseforge.com')) {
            const parts = id.split('/');
            identifier = parts[parts.length - 1] || parts[parts.length - 2];
        }

        if (isNaN(identifier)) {
            // 432 is the ID for Minecraft
            const results = await this.client.searchMods(432, { slug: identifier });
            if (results.data.length === 0) throw new Error('Mod not found');
            return results.data[0];
        }
        return await this.client.getMod(identifier);
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

    async installMod(modId, fileId, targetDir) {
        console.log(`Downloading CurseForge file (Mod: ${modId}, File: ${fileId})...`);
        
        const file = await this.client.getModFile(modId, fileId);
        if (!file.downloadUrl) throw new Error('Download URL not found for this file.');
        
        const fileName = file.fileName;
        const tempPath = path.join(process.cwd(), fileName);
        await this.downloadFile(file.downloadUrl, tempPath);

        // If it's a jar, move it to mods
        if (fileName.endsWith('.jar')) {
            const modsDir = path.join(targetDir, 'mods');
            await fs.ensureDir(modsDir);
            await fs.move(tempPath, path.join(modsDir, fileName), { overwrite: true });
            console.log('✅ Mod installation complete!');
            return;
        }

        // If it's a zip, check if it's a modpack
        if (fileName.endsWith('.zip')) {
            const zip = new AdmZip(tempPath);
            const manifestEntry = zip.getEntry('manifest.json');
            
            if (manifestEntry) {
                console.log('Detected CurseForge Modpack. Installing...');
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
                console.log('✅ Modpack installation complete!');
            } else {
                // Just a zipped mod? (rare but possible)
                const modsDir = path.join(targetDir, 'mods');
                await fs.ensureDir(modsDir);
                await fs.move(tempPath, path.join(modsDir, fileName), { overwrite: true });
                console.log('✅ Zipped mod installed to mods folder.');
            }
        }
        
        if (await fs.pathExists(tempPath)) await fs.remove(tempPath);
    }
}

module.exports = CurseForgeHandler;
