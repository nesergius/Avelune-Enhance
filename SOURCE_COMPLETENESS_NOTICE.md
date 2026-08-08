# Source completeness notice

This archive is an Avelune Enhance 2.0.0 RC6 source snapshot.

It includes the Electron application source, renderer, build and QA scripts, tests, licensing notices, model provenance documentation, native-engine corresponding source metadata and the bundled runtime files present at snapshot time.

Additional official Real-ESRGAN NCNN model files are intentionally fetched from the pinned upstream release during Windows build preparation. `tools/fetch-official-models.ps1` verifies the release archive SHA-256, verifies the pre-existing renamed model pairs byte-for-byte, installs the additional files and regenerates the packaged resource manifest before compilation.

Generated directories such as `node_modules`, `dist`, build caches and `RC6-OUTPUT` are excluded.
