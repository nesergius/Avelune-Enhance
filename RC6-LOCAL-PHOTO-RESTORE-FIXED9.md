# RC6 FIXED9 — Local Photo Restore Pro

FIXED9 removes the OpenAI/API dependency and adds an optional downloadable local restoration pack.

## Pipeline

1. GFPGAN 1.4 detects, aligns and reconstructs degraded faces.
2. Real-ESRGAN x4plus restores and enlarges non-face regions.
3. The existing Avelune NCNN/Vulkan engine performs final target-size upscaling and TTA refinement.
4. Compatible source metadata and color profile are restored.

## Model manager

Settings now provides install, reinstall and remove controls. The installer creates an isolated Python 3.10 runtime under the user data directory and downloads pinned package versions and official model weights. NVIDIA systems can select CUDA. Other computers use the universal CPU backend.

## Limits

The model generates plausible details where the source contains no recoverable information. It cannot guarantee historically exact facial texture or identity details. GFPGAN is Apache-2.0; SUPIR and StableSR were not integrated because their official terms restrict commercial use.
