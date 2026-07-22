# Avelune Enhance 2.0.0 RC3

Avelune Enhance is a local Windows desktop application for GPU-accelerated AI image enlargement and restoration. Images remain on the user's computer.

This release candidate consolidates the previous UI fixes, model catalog, secure Electron configuration, sequential GPU job queue, atomic output publishing, cancellation, input validation and diagnostic tooling.

## RC1 status

This build is intended for controlled Windows 10/11 hardware validation. It is not the final public release and is not Authenticode-signed yet.

## Supported input formats

PNG, JPG/JPEG/JFIF and WebP.

## Bundled model profiles

The package recognizes seven installed NCNN model profiles. Two profiles have documented upstream mapping. Five compatibility profiles remain marked as originating from a previous version while their complete provenance records are being reviewed. The application does not represent third-party AI models as original Avelune developments.

## License

Application source: GNU AGPL v3. Third-party components and AI models remain subject to their respective licenses and notices.


## RC3 Windows packaging

RC3 is distributed as a standalone Windows application rather than an `app.asar`
patch for an older Electron shell. Windows file metadata, application version,
executable name and AppUserModelID are generated from this source package.

The packaged DXGI diagnostic helper reports dedicated video memory directly
from Windows. It is used for diagnostics and future automatic tile selection.
