# Avelune Enhance 2.0.0 RC6

[Russian version](README.ru.md)

Avelune Enhance is a local Windows AI image enhancement and restoration studio with Vulkan acceleration. User images are processed on the computer and are not uploaded by the built-in local profiles.

## RC6 Highlights

- **Local AI image enhancement** for photos, portraits, game screenshots, digital art, anime frames and mixed image collections.
- **11 clear AI profiles** for natural upscale, faithful restore, old photo restoration, severe photo recovery, art/anime enhancement, fast processing and maximum detail.
- **Smart Restore / Auto Profile** analyzes the image and available hardware before recommending the best local profile.
- **Photo Restore Pro and Photo Restore Ultra** add optional local restoration packages for damaged photos, faces, JPEG artifacts and low-resolution images.
- **Adaptive Before/After viewer** keeps result comparison aligned across window sizes and 100/125/150% DPI.
- **Smart Queue** provides batch processing with per-file progress, pause, resume, retry failed items and skip-existing behavior.
- **Private local workflow** keeps user images on the computer for built-in local profiles.
- **Metadata and color handling** preserves compatible EXIF/XMP/IPTC/ICC data for common image formats.

## Honest RC6 Limitations

- The built-in **Neural Restore** profile is not GFPGAN and does not perform generative face replacement. It is a conservative second pass through verified restoration/upscale models. Downloadable **Photo Restore Pro** and **Photo Restore Ultra** use separate local GFPGAN/DiffBIR packages and are enabled only after installation through AI Package Manager.
- TIFF and a true end-to-end 16-bit AI pipeline are not included in RC6. The bundled NCNN runtime is currently scoped to PNG/JPEG/WebP.
- Face restoration is conservative and does not invent identity-level details when the source image does not contain enough information.
- Optional restoration packages must be installed through AI Package Manager before Photo Restore Pro/Ultra can be used.
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

Local artifacts are written to `RC6-OUTPUT`. See also [BUILDING.md](BUILDING.md) and [MODEL_PROVENANCE.md](MODEL_PROVENANCE.md).

## Licenses

Avelune Enhance source code is distributed under AGPL-3.0-only. Third-party AI models and native components keep their own licenses and attribution. See `THIRD_PARTY_NOTICES.md`, `MODEL_PROVENANCE.md` and the `licenses/` directory.
