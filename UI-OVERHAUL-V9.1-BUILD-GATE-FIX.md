# Avelune Enhance RC5.2 — UI Overhaul v9.1 build-gate fix

This maintenance revision fixes two false failures in the packaged 1366×768 UI probe.

- The horizontal-overflow check now measures the workflow and its real scroll container instead of the entire sidebar. The sidebar collapse handle intentionally protrudes into the workspace and must not count as content overflow.
- The clipboard preview check now validates the loaded image dimensions and the numeric dimensions displayed by the UI. It no longer depends on the exact multiplication-sign encoding used when diagnostic JSON is relayed through Windows PowerShell.
- No inference engine, model, IPC payload, processing queue, or production UI behavior was changed.
