# Avelune Enhance native-engine modifications

## Reviewed upstream baseline

- Repository: https://github.com/upscayl/upscayl-ncnn
- Release: `upscayl-bin-20240601-103425`
- Commit: `22774bc42e2bc3c785b5b585d213d960b1348ad5`
- Official Windows executable SHA-256: `704fd622984220c8c646a8dff4c7eba1cc62fbb8c47383996f38571f76b73fbf`
- Avelune executable SHA-256: `111cb3ec6b4fdf93cd92e8915d12b17f0e70bf73089e930345d216e4f974fe90`

## Source-level modifications

Only two user-visible string literals are changed:

1. `Usage: upscayl-bin.exe -i infile -o outfile [options]...` becomes `Usage: avelune-engine.exe -i infile -o outfile [options]...`.
2. The source success message ending in `Upscayled Successfully!` becomes `[OK] Avelune task completed!`.

The replacement strings have matching compiled byte lengths. Binary review found:

- identical PE file size;
- 32 changed bytes;
- four changed ranges;
- all changes in `.rdata`;
- no changes in `.text`;
- no executable-code changes;
- the recorded binary patch reproduces the reviewed Avelune executable exactly.

Files changed by the source patch:

- `src/main.cpp`

Authoritative files:

- `avelune-engine-source.patch`
- `avelune-engine.binary-patch.json`
