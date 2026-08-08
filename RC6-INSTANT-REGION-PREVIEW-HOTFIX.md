# RC6 Instant Region Preview hotfix (FIXED6)

## Symptom

The source crop was visible, but the enhanced comparison layer was blank and displayed the alt text `Улучшенный фрагмент`.

## Root cause

The region-preview completion handler assigned a direct `file://` URL and marked the preview complete immediately. In packaged Chromium that URL can fail to render even though the output file exists. The normal full-image result already had a validated IPC binary fallback, but the region preview did not.

## Fix

- Read the completed preview result through the existing trusted `avelune:get-image-preview` IPC handler.
- Create a renderer-owned Blob URL and wait for a successful image decode before hiding progress.
- Keep the non-Electron file URL only for browser/demo mode.
- Remove failed cache entries and limit the cache to eight results with Blob URL cleanup.
- Add a regression test that prevents restoring the direct unchecked assignment.

This changes preview display only. AI processing, model selection, output files and integrity checks remain unchanged.
