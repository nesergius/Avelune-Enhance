# RC6 runtime manifest hotfix (FIXED4)

The packaged application previously verified resources against `src/resource-integrity.json`, while the Windows build regenerated only `resources/resource-manifest.json`. After official RC6 models were downloaded, the packaged manifest contained all 16 resources but the ASAR mirror still listed the original seven.

FIXED4 makes `process.resourcesPath/resource-manifest.json` the sole runtime source of truth, synchronizes the source audit mirror during generation, and makes the pre-package verifier fail when the two files differ.
