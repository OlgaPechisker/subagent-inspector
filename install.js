#!/usr/bin/env node

// install.js - Copilot CLI extension installer
// Copies extension files to ~/.copilot/extensions/subagent-inspector/

import { existsSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTENSION_NAME = 'subagent-inspector';

// Determine target directory
const targetDir = join(homedir(), '.copilot', 'extensions', EXTENSION_NAME);

// Skip installation if running from the target directory (avoid infinite loop)
if (__dirname === targetDir) {
    console.log('✓ Extension is already in the correct location');
    process.exit(0);
}

// Skip installation in CI environments
if (process.env.CI || process.env.npm_config_global === 'false') {
    console.log('⏭️  Skipping extension installation (CI or local install)');
    process.exit(0);
}

console.log(`Installing Copilot CLI extension: ${EXTENSION_NAME}`);
console.log(`Target: ${targetDir}`);

try {
    // Ensure target directory exists
    mkdirSync(targetDir, { recursive: true });

    // Copy extension files
    const filesToCopy = readdirSync(__dirname).filter(file => {
        // Skip node_modules, package-lock, install script, and hidden files
        return !file.startsWith('.') && 
               file !== 'node_modules' && 
               file !== 'package-lock.json' &&
               file !== 'install.js';
    });

    for (const file of filesToCopy) {
        const src = join(__dirname, file);
        const dest = join(targetDir, file);
        cpSync(src, dest, { recursive: true, force: true });
        console.log(`  ✓ Copied ${file}`);
    }

    console.log('\n✅ Extension installed successfully!');
    console.log('\nNext steps:');
    console.log('  1. Restart Copilot CLI with: /restart');
    console.log('  2. Verify installation with: /env');
    console.log('  3. Use /subagent-logs to view logs');
    console.log(`\nLogs location: ${join(homedir(), '.copilot', 'subagent-logs')}`);

} catch (error) {
    console.error('\n❌ Installation failed:', error.message);
    console.error('\nManual installation:');
    console.error(`  1. Copy extension files to: ${targetDir}`);
    console.error('  2. Restart Copilot CLI with: /restart');
    process.exit(1);
}
