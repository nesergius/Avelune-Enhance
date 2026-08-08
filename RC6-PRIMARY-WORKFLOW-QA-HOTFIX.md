# RC6 primary workflow visual-QA hotfix

## Symptom

Every visual-QA viewport failed only `primaryWorkflowReachable`, even though the packaged application launched and the sidebar was rendered correctly.

## Root cause

The release probe required both `#sidebar-select-file-button` and `#start-button` to be descendants of `.controls-scroll`. In RC6 this is intentionally false:

- the source picker is inside `.controls-scroll`;
- the start button is inside the fixed `.process-footer`, which remains visible while settings scroll.

The gate therefore rejected the intended layout on every resolution and DPI scale.

## Fix

The probe now validates the actual RC6 structure:

- the start button belongs to `.enhance-workflow`;
- the source picker belongs to `.controls-scroll`;
- both controls have non-zero geometry, are not hidden, and intersect the viewport.

The QA JSON now records both control rectangles under `primaryWorkflow` for future diagnostics.

No runtime processing, model, queue, security, or image-quality behavior was changed.
