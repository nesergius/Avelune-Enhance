# Changelog

## 2.0.0 RC3

- Consolidated all UI fixes through the model-manager release.
- Enabled Electron sandbox, context isolation and web security.
- Added strict IPC allowlists and sender validation.
- Added Content Security Policy and blocked navigation, webviews and permissions.
- Added a sequential GPU job queue and targeted cancellation of the active task.
- Added strict validation for paths, formats, model identifiers, dimensions and clipboard payloads.
- Added output-size limits and corrupt-image detection.
- Added temporary output files and atomic publication of completed results.
- A task now succeeds only after a zero engine exit code and successful result decoding.
- Batch processing publishes every image separately and reports per-file progress.
- Double pass preserves the requested target width instead of producing an accidental 16x result.
- Added SHA-256 integrity validation for the engine and bundled model files.
- Removed the debug runtime DLL.
- Renamed the local engine and remaining old internal profile IDs to Avelune-neutral names.
- Replaced technical references to model “weights” in the UI with user-friendly wording.
- Added Windows hardware and driver diagnostic scripts for the 2/7 release gate.
