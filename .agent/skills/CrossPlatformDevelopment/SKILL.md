---
name: Cross-Platform Development Standards
description: Guidelines and requirements for ensuring code works across Windows, macOS, and Linux.
---

# Cross-Platform Development Standards

## Core Principle
**ALL code must be designed to run identically on Windows, macOS, and Linux.** Never assume the environment is Windows just because the current user is on Windows.

## File System & Paths

1.  **Never hardcode path separators**.
    *   ❌ `path + '\\' + file` or `path + '/' + file`
    *   ✅ Use `path.join(dir, file)` which handles OS separators automatically.
    *   ✅ When working with URIs or Web APIs (Vite/Electron renderer), prefer forward slashes `/`.

2.  **Handling Absolute Paths**:
    *   **Windows**: Starts with a drive letter (e.g., `C:\User`).
    *   **POSIX**: Starts with slash (e.g., `/home/user`).
    *   **Normalization**: When comparing paths, always normalize them `(path.replace(/\\/g, '/'))`.

3.  **Electron & Node.js URLs**:
    *   Use `pathToFileURL(absolutePath).toString()` from `url` module to generate `file://` URLs.
    *   Do **NOT** manually construct file URLs (e.g., `'file:///' + path`), as this fails with special characters (spaces, `#`, `?`) and differs between OS (handling of drive letters).

## Electron Protocols
*   **Protocol Handlers**: When implementing `protocol.handle`, use `new URL(request.url)` to parse.
*   **Path Extraction**:
    *   On **Windows**, `url.pathname` from a file URL often looks like `/C:/Users/...`. You may need to conditionally strip the leading slash:
        ```typescript
        if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(pathname)) {
            pathname = pathname.slice(1);
        }
        ```
    *   On **macOS/Linux**, `url.pathname` is already a valid absolute path (e.g., `/Users/name/...`).

## Key Checklists
- [ ] Are path joins using `path.join()`?
- [ ] Is URL construction using `pathToFileURL()`?
- [ ] Are manual slash replacements safe for all OS?
- [ ] Is specific `process.platform` logic isolated and justified?
