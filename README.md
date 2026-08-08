# Avelune Enhance 2.0.0 RC6

[Russian version](README.ru.md)

Avelune Enhance is a local Windows AI image enhancement and restoration studio with Vulkan acceleration. User images are processed on the computer and are not uploaded by the built-in local profiles.

## RC6 Highlights

- **11 transparent profiles** built on 6 verified official NCNN models plus 2 optional downloadable local restoration packages: Smart Restore, Natural, Game Images, Neural Restore, Photo Restore Ultra, Photo Restore Pro, Restore Faithful, Art, Anime Video, Fast 2x and Detail+.
- **Smart Restore / Auto Profile** analyzes saturation, edges, noise, JPEG blocking, blur, brightness, resolution and available VRAM before recommending a processing path.
- **Adaptive Before/After viewer** keeps result comparison aligned across window sizes and 100/125/150% DPI with a precise divider and safe file/clipboard preview.
- **Smart Queue** provides batch processing with per-file progress, pause, resume, retry failed items, skip existing results and persisted queue state.
- **Local photo restoration** uses the built-in Neural Restore through RealESRNet/Real-ESRGAN, while downloadable Photo Restore Pro and Photo Restore Ultra add GFPGAN/DiffBIR cascades for heavier restoration work.
- **Metadata and color handling** safely preserves compatible EXIF/XMP/IPTC/ICC blocks for JPEG, PNG and extended WebP.
- **GPU AutoTune** runs a local benchmark, selects tile size and retries with smaller tiles after VRAM/device-loss failures.
- **Release QA gate** validates packaged startup, native engine smoke processing, screenshot-based UI checks and five window/DPI configurations.
- **Updated production logo** provides transparent PNG/ICO assets for the window, taskbar, installer and website.

## Honest RC6 Limitations

- The built-in **Neural Restore** profile is not GFPGAN and does not perform generative face replacement. It is a conservative second pass through verified restoration/upscale models. Downloadable **Photo Restore Pro** and **Photo Restore Ultra** use separate local GFPGAN/DiffBIR packages and are enabled only after installation through AI Package Manager.
- TIFF and a true end-to-end 16-bit AI pipeline are not included in RC6. The bundled NCNN runtime is currently scoped to PNG/JPEG/WebP.
- Face restoration strength controls whether and how the second pass runs; RC6 does not yet do pixel-level face-mask blending.
- Additional official model files are downloaded and verified during Windows build preparation. The normal application workflow does not use network access for model processing.
- The old separate fragment preview workflow is not part of the public RC6 UI. Result comparison now uses one adaptive Before/After workspace.
- RC6 release assets are unsigned. Public stable distribution still requires Authenticode signing and final antivirus verification.

## Supported Formats

Input: PNG, JPG/JPEG, JFIF, WebP.
Output: PNG, JPG, WebP.

## Windows Downloads

Regular users do not need to build the project manually. Download the installer or portable build from [GitHub Releases](https://github.com/nesergius/Avelune-Enhance/releases):

- `Avelune-Enhance-2.0.0-RC6-Setup-x64.exe` - standard Windows installer;
- `Avelune-Enhance-2.0.0-RC6-Portable-x64.exe` - portable build without installation;
- `SHA256SUMS.txt` - checksums for download verification.

## Build From Source

For a reproducible local build and full QA, run the canonical release builder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-rc6-release.ps1
```

The builder will:

- verify and prepare pinned official models;
- generate and verify the packaged resource manifest;
- run `npm ci` and the full automated test suite;
- create Setup and Portable builds;
- verify startup, engine processing, clipboard preview and UI/DPI behavior;
- write SHA-256 checksums and QA reports.

Local artifacts are written to `RC6-OUTPUT`. See also [BUILDING.md](BUILDING.md), [RC6-IMPLEMENTATION-STATUS.md](RC6-IMPLEMENTATION-STATUS.md) and [MODEL_PROVENANCE.md](MODEL_PROVENANCE.md).

## Licenses

Avelune Enhance source code is distributed under AGPL-3.0-only. Third-party AI models and native components keep their own licenses and attribution. See `THIRD_PARTY_NOTICES.md`, `MODEL_PROVENANCE.md` and the `licenses/` directory.
