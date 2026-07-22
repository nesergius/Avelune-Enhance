# Avelune Enhance 2.0.0 RC4

Avelune Enhance is an open-source Windows desktop application for local,
GPU-accelerated AI image enlargement and restoration.

Image processing is performed locally on the user's computer.

## Release status

Avelune Enhance 2.0.0 RC4 is a release candidate intended for controlled
testing on Windows 10 and Windows 11.

This build is not the final public release and is not currently signed with a
trusted Authenticode certificate. Windows may display an Unknown Publisher or
Microsoft Defender SmartScreen warning.

Verify the published SHA-256 checksums before running downloaded executables.

## Features

- Local image processing
- GPU acceleration through NCNN and Vulkan
- Windows Setup and Portable distributions
- Sequential GPU job queue
- Job cancellation
- Atomic output publishing
- Input and output validation
- Secure Electron configuration
- Dedicated GPU memory diagnostics through DXGI
- Resource integrity verification
- Seven bundled model profiles
- Custom model folder support

## Supported input formats

- PNG
- JPG
- JPEG
- JFIF
- WebP

## Bundled model profiles

The application recognizes seven installed NCNN model profiles:

- avelune-standard-4x
- digital-art-4x
- avelune-lite-4x
- high-fidelity-4x
- remacri-4x
- ultramix-balanced-4x
- ultrasharp-4x

Two profiles have documented upstream mappings.

Five compatibility profiles originate from an earlier project version. Their
provenance records are being reviewed and must not be interpreted as original
Avelune model developments.

Avelune Enhance does not claim ownership of third-party AI models.

See:

- [Model provenance](MODEL_PROVENANCE.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Native processing engine

The packaged native processing engine is derived from the open-source
`upscayl-ncnn` project.

The repository and release source packages include:

- the exact upstream commit;
- initialized upstream submodules;
- a source-level modification patch;
- binary comparison evidence;
- corresponding source;
- rebuilding documentation.

The reviewed Avelune modification changes user-facing string data without
changing the executable code section.

See:

- [Native engine source information](NATIVE_ENGINE_SOURCE.md)
- [Native engine source status](NATIVE_ENGINE_SOURCE.json)

## RC4 Windows packaging

RC4 is distributed as a standalone Windows application rather than as an
`app.asar` patch for an existing Electron installation.

The following values are generated from this source package:

- Windows file metadata
- Application version
- Executable name
- AppUserModelID
- Setup package
- Portable package
- Update metadata

The packaged DXGI diagnostic helper reports dedicated video memory directly
from Windows. It is used for diagnostics and future automatic tile selection.

## Security

The application uses:

- Electron context isolation;
- disabled Node.js integration in the renderer;
- a restricted preload API;
- whitelisted IPC channels;
- trusted renderer event validation;
- strict Content Security Policy;
- input path and model ID validation;
- packaged resource integrity checks;
- output dimension limits;
- sequential GPU processing.

Security reports should follow the instructions in:

[SECURITY.md](SECURITY.md)

## Privacy

User images are processed locally.

The application does not upload user images to an external processing service.
Network access may be used for user-initiated update checks.

See:

[PRIVACY.md](PRIVACY.md)

## Building from source

Build requirements and instructions are available in:

[BUILDING.md](BUILDING.md)

The automated test suite can be started with:

```bash
npm test