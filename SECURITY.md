# Security policy

## Supported candidate

Security fixes are currently prepared for the newest Avelune Enhance release candidate only.

## Reporting a vulnerability

Please report vulnerabilities privately through the security contact published at `https://avelune.sayqq.ru/` rather than opening a public issue with exploit details. Include the affected version, reproduction steps, expected impact and any relevant logs with personal file paths removed.

## Security properties

Avelune uses Electron context isolation, a sandboxed renderer, a strict Content Security Policy, whitelisted IPC channels, validated image/model paths, immutable job identifiers, packaged resource SHA-256 verification and disabled Node.js execution in the renderer. Images are processed locally.

Do not publish a candidate until the Windows binaries are Authenticode-signed, timestamped and scanned with Microsoft Defender plus an independent multi-engine service.
