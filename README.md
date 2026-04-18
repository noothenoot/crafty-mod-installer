# 🛠️ Crafty Mod Installer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)

An automated command-line tool designed to bridge **Crafty Controller** with **Modrinth** and **CurseForge**. Create servers and install complex modpacks with a single command.

---

## ✨ Features

- 🔗 **Dual Platform Support**: Seamlessly integrate with Modrinth (`.mrpack`) and CurseForge (official API).
- 🏗️ **Automatic Server Creation**: Create new Minecraft instances in Crafty directly from the CLI.
- ⚡ **Local/Remote Modes**: 
  - **Local**: Blazing fast direct filesystem installation.
  - **Remote**: Prepares files for upload or communicates via API.
- 📦 **Modpack Awareness**: Automatically handles `manifest.json`, `modrinth.index.json`, and server-side overrides.
- 💬 **Interactive Interface**: Step-by-step prompts for selecting versions, file types, and server settings.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Crafty Controller v4](https://craftycontrol.com/)
- [CurseForge API Key](https://console.curseforge.com/) (Optional, for CurseForge support)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/crafty-mod-installer.git
   cd crafty-mod-installer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and fill in your Crafty URL, Token, and CurseForge Key.*

### Usage

Start the interactive installer:
```bash
node index.js
```

---

## 🛠️ Technical Details

### Dependencies
- `curseforge-api`: Official wrapper for CurseForge Eternal API.
- `axios`: For high-speed Modrinth and Crafty API requests.
- `inquirer`: For a polished CLI user experience.
- `adm-zip`: Robust ZIP and MRPack extraction.

### Folder Structure
- `index.js`: Orchestrator and CLI logic.
- `crafty.js`: Specialized client for Crafty v2/v4 API.
- `modrinth.js`: Modrinth-specific parsing and downloading logic.
- `curseforge.js`: CurseForge-specific parsing and manifest handling.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/crafty-mod-installer/issues).

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Made with ❤️ for the Minecraft Server Community.*
