const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const appName = 'PoroMac.app';
const targetApp = path.join(distDir, appName);
const electronApp = path.join(rootDir, 'node_modules', 'electron', 'dist', 'Electron.app');

console.log('❄️  Building PoroMac.app for macOS...');

// 1. Clean & create dist directory
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// 2. Copy Electron.app bundle preserving symlinks (-R)
execSync(`cp -R "${electronApp}" "${targetApp}"`);

// 3. Copy application source into Contents/Resources/app
const resourcesAppDir = path.join(targetApp, 'Contents', 'Resources', 'app');
fs.mkdirSync(resourcesAppDir, { recursive: true });

fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(resourcesAppDir, 'package.json'));
execSync(`cp -R "${path.join(rootDir, 'src')}" "${path.join(resourcesAppDir, 'src')}"`);

// 4. Customize Info.plist with PoroMac name and bundle identifier
const plistPath = path.join(targetApp, 'Contents', 'Info.plist');
try {
  execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleName PoroMac" "${plistPath}"`);
  execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName PoroMac" "${plistPath}"`);
  execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.tobias.poromac" "${plistPath}"`);
  execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 0.1.0" "${plistPath}"`);
  // Set LSUIElement so macOS allows the panel window to float over Fullscreen Spaces & Games
  execSync(`/usr/libexec/PlistBuddy -c "Delete :LSUIElement" "${plistPath}" 2>/dev/null || true`);
  execSync(`/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "${plistPath}"`);
} catch (err) {
  console.warn('Plist update notice:', err.message);
}

// 5. Re-sign bundle ad-hoc so macOS Apple Silicon (arm64) allows launching without Gatekeeper error
try {
  execSync(`codesign --force --deep --sign - "${targetApp}"`);
} catch (err) {
  console.warn('Codesign notice:', err.message);
}

console.log(`✅ Build complete: ${targetApp}`);
