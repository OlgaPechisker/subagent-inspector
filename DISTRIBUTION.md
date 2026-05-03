# Distribution Guide: Subagent Inspector Extension

This document explains all distribution methods for the Subagent Inspector extension.

---

## 📦 Distribution Methods

### Method 1: NPM Package (Recommended for Enterprise)

**Pros:**
- ✅ Familiar to developers (npm ecosystem)
- ✅ Automatic installation to correct location
- ✅ Version management built-in
- ✅ Easy updates with `npm update`
- ✅ Can use private npm registry for internal distribution

**Setup:**

1. **Publish to npm (public or private registry):**

   ```bash
   # Public npm
   npm login
   npm publish --access public
   
   # Private npm (organization scope)
   npm publish --access restricted
   
   # Private registry (e.g., Artifactory, GitHub Packages)
   npm config set registry https://npm.your-company.com/
   npm publish
   ```

2. **Users install with:**
   ```bash
   npm install -g @your-org/copilot-subagent-inspector
   ```

3. **The postinstall script automatically:**
   - Creates `~/.copilot/extensions/subagent-inspector/`
   - Copies all extension files
   - Shows success message with next steps

4. **Users restart Copilot CLI:**
   ```
   /restart
   ```

**Updates:**
```bash
npm update -g @your-org/copilot-subagent-inspector
```

---

### Method 2: GitHub Repository (Best for Open Source)

**Pros:**
- ✅ Version control and history
- ✅ Pull requests and collaboration
- ✅ GitHub Issues for bug tracking
- ✅ Free hosting
- ✅ Easy updates with git pull

**Setup:**

1. **Create GitHub repository:**
   ```bash
   git remote add origin https://github.com/your-org/copilot-subagent-inspector.git
   git push -u origin master
   ```

2. **Users install with:**
   ```bash
   # Clone directly to extensions directory
   git clone https://github.com/your-org/copilot-subagent-inspector.git ~/.copilot/extensions/subagent-inspector
   ```

3. **Users restart Copilot CLI:**
   ```
   /restart
   ```

**Updates:**
```bash
cd ~/.copilot/extensions/subagent-inspector
git pull
```

---

### Method 3: Per-Repository Extension (Best for Project-Specific Tools)

**Pros:**
- ✅ Zero installation needed
- ✅ Version-controlled alongside code
- ✅ Automatically available to all team members
- ✅ No separate distribution needed

**Setup:**

1. **Copy extension to repository:**
   ```bash
   cd /path/to/your/project
   mkdir -p .github/extensions
   cp -r ~/.copilot/extensions/subagent-inspector .github/extensions/
   ```

2. **Commit to repository:**
   ```bash
   git add .github/extensions/subagent-inspector
   git commit -m "Add subagent-inspector extension"
   git push
   ```

3. **Usage:**
   - Team members clone/pull the repository
   - Run `copilot` in the repository directory
   - Extension auto-loads (no installation needed!)

**Updates:**
- Update files in `.github/extensions/subagent-inspector/`
- Commit and push
- Team members pull changes

---

### Method 4: Zip/Tarball Archive (Best for Air-Gapped Environments)

**Pros:**
- ✅ Works without internet
- ✅ Simple file sharing
- ✅ No external dependencies

**Create archive:**
```bash
cd ~/.copilot/extensions
tar -czf subagent-inspector-v1.1.0.tar.gz subagent-inspector/

# Or zip
zip -r subagent-inspector-v1.1.0.zip subagent-inspector/
```

**Distribute:** Email, Slack, internal file share, USB drive

**Users install:**
```bash
# Extract to extensions directory
tar -xzf subagent-inspector-v1.1.0.tar.gz -C ~/.copilot/extensions/

# Or unzip
unzip subagent-inspector-v1.1.0.zip -d ~/.copilot/extensions/
```

**Updates:**
- Create new archive with version number
- Users extract to replace old version

---

### Method 5: Installation Script (Best for Automation)

**Pros:**
- ✅ One-command installation
- ✅ Can install from GitHub releases
- ✅ Error handling and validation

**Create install script:**

**install.sh (Mac/Linux):**
```bash
#!/bin/bash
set -e

EXTENSION_NAME="subagent-inspector"
INSTALL_DIR="$HOME/.copilot/extensions/$EXTENSION_NAME"
GITHUB_REPO="your-org/copilot-subagent-inspector"
VERSION="${1:-master}"  # Default to master, or pass version tag

echo "Installing $EXTENSION_NAME from GitHub..."

# Remove existing installation
rm -rf "$INSTALL_DIR"

# Clone repository
git clone --depth 1 --branch "$VERSION" \
  "https://github.com/$GITHUB_REPO.git" "$INSTALL_DIR"

# Remove .git directory (optional)
rm -rf "$INSTALL_DIR/.git"

echo "✅ Extension installed successfully!"
echo "Restart Copilot CLI with: /restart"
```

**install.ps1 (Windows):**
```powershell
param(
    [string]$Version = "master"
)

$ExtensionName = "subagent-inspector"
$InstallDir = "$env:USERPROFILE\.copilot\extensions\$ExtensionName"
$GitHubRepo = "your-org/copilot-subagent-inspector"

Write-Host "Installing $ExtensionName from GitHub..."

# Remove existing installation
if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
}

# Clone repository
git clone --depth 1 --branch $Version `
  "https://github.com/$GitHubRepo.git" $InstallDir

# Remove .git directory (optional)
Remove-Item -Recurse -Force "$InstallDir\.git" -ErrorAction SilentlyContinue

Write-Host "✅ Extension installed successfully!" -ForegroundColor Green
Write-Host "Restart Copilot CLI with: /restart"
```

**Distribute:** Share the script. Users run:
```bash
# Install latest
./install.sh

# Install specific version
./install.sh v1.1.0
```

---

## 🎯 Recommendation by Use Case

| Use Case | Recommended Method | Why |
|----------|-------------------|-----|
| **Internal company tool** | NPM (private registry) | Centralized, versioned, familiar workflow |
| **Open source project** | GitHub Repository | Community collaboration, free hosting |
| **Project-specific** | Per-Repository | Zero installation, travels with code |
| **Air-gapped network** | Zip Archive | Works offline |
| **One-time setup** | Installation Script | Simplest for end users |

---

## 📊 Comparison Matrix

| Method | Installation Effort | Update Ease | Versioning | Offline | Auto-discovery |
|--------|-------------------|-------------|------------|---------|----------------|
| **NPM** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ | ❌ | ✅ |
| **GitHub** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ | ❌ | ✅ |
| **Per-Repo** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ✅ |
| **Zip** | ⭐⭐⭐ | ⭐⭐ | Manual | ✅ | ✅ |
| **Script** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ | ❌ | ✅ |

---

## 🚀 Getting Started (Quick Pick)

**For most teams:** Start with **GitHub + npm**
1. Push code to GitHub repository
2. Publish to npm (public or private)
3. Users choose: `npm install -g` OR `git clone`

This gives you maximum flexibility and all the benefits of both ecosystems.

---

## 📝 Publishing Checklist

Before publishing:

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` (create one if needed)
- [ ] Run tests: `npm test`
- [ ] Update README with installation instructions
- [ ] Tag release in git: `git tag v1.1.0 && git push --tags`
- [ ] Test installation in clean environment
- [ ] Document breaking changes (if any)

---

## 🔐 Private NPM Registry Setup

**GitHub Packages:**
```bash
# .npmrc
@your-org:registry=https://npm.pkg.github.com

# Publish
npm publish
```

**Artifactory:**
```bash
npm config set registry https://artifactory.your-company.com/api/npm/npm-local/
npm publish
```

**Verdaccio (self-hosted):**
```bash
npm config set registry http://localhost:4873/
npm publish
```

---

## ❓ FAQ

**Q: Can I use both npm and git installation methods?**  
A: Yes! Users can choose whichever they prefer.

**Q: Do users need Node.js installed?**  
A: Only for npm installation. Git installation doesn't require Node.js.

**Q: Can I install multiple versions?**  
A: No, only one version per extension directory. Use `npm update` or `git pull` to upgrade.

**Q: What if users have custom modifications?**  
A: Updates will overwrite custom changes. For customization, fork the repository.

---

For questions or issues, open an issue on GitHub or contact your team's extension maintainer.
