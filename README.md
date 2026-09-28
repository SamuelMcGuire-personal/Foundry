# Foundry Desktop Pilot 1.0 — Proper App Shell

This is the first proper desktop-shell build of Foundry.

## What changed

The renderer no longer owns filesystem access.

Native Electron main-process actions now handle:

- Choose Foundry Home
- Create workspace structure
- Scan project folders
- Create projects
- Archive / restore projects
- Import working files
- Read files
- Create / restore snapshots
- Library backup
- Native clipboard
- Import AI-result file
- Persistent theme / workspace setting

The UI is loaded inside Electron with:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- narrow named preload APIs

## Manual AI remains first-class

No API key is required:

1. Open a project.
2. Compile the prompt.
3. Copy prompt.
4. Use ChatGPT / Claude / Gemini / a local model.
5. Paste or import result.
6. Continue in Foundry.

API-provider execution will be optional.

## macOS Catalina compatibility

Electron 32.3.3 is pinned because Electron 33+ dropped macOS 10.15 Catalina support.

Electron 32 is end-of-support upstream, so this is a compatibility pilot rather than the long-term runtime for newer systems.

## Packaging

The GitHub Actions workflow builds:
- macOS Intel x64 `.zip` and `.dmg`
- macOS Apple Silicon arm64 `.zip` and `.dmg`
- Windows x64 installer and `.zip`

No development setup is needed on the testing machine once the CI artifact is built.
