# Rebuilding the Avelune native engine

## Exact source

Use the included corresponding-source tree based on commit:

`22774bc42e2bc3c785b5b585d213d960b1348ad5`

All required submodules are included at their recorded commits.

## Requirements

The upstream project uses CMake, a C/C++ compiler, OpenMP and Vulkan development libraries or the Vulkan SDK. Refer to the included upstream README and CI files for environment-specific dependencies.

## Build procedure

From the modified source root included in the archive (`source/`):

```text
mkdir build
cd build
cmake ../src
cmake --build . --config Release --parallel 2
```

Compiler and build-environment differences can change the final binary hash. The release review separately verifies the supplied executable against the official release and the deterministic binary transformation.

After building, use the produced `upscayl-bin.exe` as the native backend and name the distributed copy `avelune-engine.exe`.

## Applying the patch to a clean checkout

```text
git checkout 22774bc42e2bc3c785b5b585d213d960b1348ad5
git submodule update --init --recursive
git apply --check avelune-engine-source.patch
git apply avelune-engine-source.patch
```

The patch must change only the two documented string literals.
