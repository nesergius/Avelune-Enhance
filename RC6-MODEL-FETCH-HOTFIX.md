# RC6 model fetch hotfix

The official `realesrgan-ncnn-vulkan-20220424-windows.zip` asset does not contain `realesrnet-x4plus.bin` or `.param`, although the NCNN runtime supports that model.

The corrected builder uses:

- v0.2.5.0 / NCNN 20220424 for the current RealESRGAN and AnimeVideo-v3 files;
- v0.2.3.0 / NCNN 20211212 only for RealESRNet x4plus.

Security checks:

- the v0.2.5.0 archive remains pinned to SHA-256 `abc02804e17982a3be33675e4d471e91ea374e65b70167abc09e31acb412802d`;
- `realesrnet-x4plus.bin` must match `26bccfcc82d9e8260c0c6b0dffb34ab297982740882d1f33c6d423f70b562c40`;
- `realesrnet-x4plus.param` must match `35330ececcea33b6c397a72548e788d5d53becee4734c50b7fada36e89f10a86`;
- a stale or corrupt cached fallback archive is deleted and downloaded again once;
- the final files in `resources/models` are verified again before the manifest is written.
