# Avelune Enhance native-engine modifications

## Reviewed upstream baseline

- Repository: https://github.com/upscayl/upscayl-ncnn
- Release: upscayl-bin-20240601-103425
- Commit: $Commit
- Official Windows executable SHA-256: $OfficialEngineSha256
- Avelune executable SHA-256: $AveluneEngineSha256

## Source-level modifications

Only two user-visible string literals are changed:

1. $OfficialUsage
   becomes
   $AveluneUsage

2. The source string literal ending in $SuccessPhrase
   becomes
   [OK] Avelune task completed!

The strings have matching compiled byte lengths. Binary review found:

- same PE file size;
- 32 changed bytes;
- four changed ranges;
- all changes in .rdata;
- no changes in .text;
- no executable-code changes;
- the recorded binary patch reproduces the tested Avelune executable exactly.

Files changed by the source patch:

- `src/main.cpp`


The authoritative patch is velune-engine-source.patch.
The reviewed binary transformation is velune-engine.binary-patch.json.