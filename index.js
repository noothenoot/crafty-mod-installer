require('dotenv').config();
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const CraftyClient = require('./crafty');
const ModrinthHandler = require('./modrinth');
const CurseForgeHandler = require('./curseforge');

async function main() {
    console.log('--- Crafty Controller Mod Installer ---');

    // 1. Initial Checks
    if (!process.env.CRAFTY_URL || !process.env.CRAFTY_API_TOKEN) {
        console.error('Error: Please configure CRAFTY_URL and CRAFTY_API_TOKEN in .env file.');
        process.exit(1);
    }

    const crafty = new CraftyClient(process.env.CRAFTY_URL, process.env.CRAFTY_API_TOKEN);
    const modrinth = new ModrinthHandler();
    const curseforge = new CurseForgeHandler(process.env.CURSEFORGE_API_KEY);

    try {
        const connected = await crafty.testConnection();
        if (!connected) throw new Error('Could not connect to Crafty Controller.');
        console.log('✅ Connected to Crafty Controller.');

        // 2. Setup Mode
        const { isLocal } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isLocal',
                message: 'Is Crafty Controller installed on this machine?',
                default: true
            }
        ]);

        let serverPath = '';
        if (isLocal) {
            const { pathInput } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'pathInput',
                    message: 'Enter the path to your Crafty servers directory:',
                    default: process.env.CRAFTY_SERVERS_PATH || ''
                }
            ]);
            serverPath = pathInput;
        }

        // 3. Server Selection
        const { serverAction } = await inquirer.prompt([
            {
                type: 'list',
                name: 'serverAction',
                message: 'Do you want to create a new server or use an existing one?',
                choices: ['Create New Server', 'Use Existing Server']
            }
        ]);

        let targetServerId = '';
        if (serverAction === 'Create New Server') {
            const { name, port, memory } = await inquirer.prompt([
                { type: 'input', name: 'name', message: 'Server Name:', default: 'Modded Server' },
                { type: 'number', name: 'port', message: 'Port:', default: 25565 },
                { type: 'number', name: 'memory', message: 'Memory (MB):', default: 4096 }
            ]);
            const newServer = await crafty.createServer(name, 'minecraft_java', memory, port);
            targetServerId = newServer.server_id;
            console.log(`✅ Server created: ${name} (ID: ${targetServerId})`);
        } else {
            const servers = await crafty.listServers();
            const { selection } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'selection',
                    message: 'Select a server:',
                    choices: servers.map(s => ({ name: s.server_name, value: s.server_id }))
                }
            ]);
            targetServerId = selection;
        }

        // 4. Mod Selection
        const { platform } = await inquirer.prompt([
            {
                type: 'list',
                name: 'platform',
                message: 'Which platform are you using?',
                choices: ['Modrinth', 'CurseForge']
            }
        ]);

        const { identifier } = await inquirer.prompt([
            {
                type: 'input',
                name: 'identifier',
                message: `Enter ${platform} Link or ID:`
            }
        ]);

        // 5. Installation
        console.log('🔄 Preparing installation...');

        // Determine final target directory
        let targetDir = '';
        if (isLocal) {
            const serverInfo = await crafty.getServerDetails(targetServerId);
            // Crafty stores servers in folders named by their UUID or name
            // We assume the folder is in the base serverPath
            targetDir = path.join(serverPath, serverInfo.server_id);
            // Note: Crafty 4 might use specific naming, we should verify info.path
            if (serverInfo.path) targetDir = serverInfo.path;
        } else {
            targetDir = path.join(process.cwd(), 'temp_server_files');
            await fs.ensureDir(targetDir);
        }

        if (platform === 'Modrinth') {
            const project = await modrinth.getProject(identifier);
            const versions = await modrinth.getVersions(project.id);
            const { versionSelection } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'versionSelection',
                    message: 'Select a version to install:',
                    choices: versions.slice(0, 10).map(v => ({ name: `${v.version_number} (${v.loaders.join(', ')})`, value: v.id }))
                }
            ]);
            await modrinth.installModpack(versionSelection, targetDir);
        } else {
            const mod = await curseforge.getMod(identifier);
            const files = await curseforge.getFiles(mod.id);
            const { fileSelection } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'fileSelection',
                    message: 'Select a file to install:',
                    choices: files.slice(0, 10).map(f => ({ name: f.displayName, value: f.id }))
                }
            ]);
            await curseforge.installModpack(mod.id, fileSelection, targetDir);
        }

        if (!isLocal) {
            console.log('🚀 Remote mode: Files are in ./temp_server_files. Please upload them to Crafty.');
        } else {
            console.log(`✅ Success! Files installed to: ${targetDir}`);
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

main();
