# Rebuilding the Avelune native engine

## Exact source

Use the included corresponding-source tree based on commit:

$Commit

All required submodules are included at their recorded commits.

## Requirements

The upstream project uses CMake, a C/C++ compiler, OpenMP, and Vulkan
development libraries or the Vulkan SDK. Refer to the included upstream
README.md and CI files for environment-specific dependency versions.

## Build procedure

From the modified source root:

```text
mkdir build
cd build
cmake ../src
cmake --build . --config Release --parallel 2
```

The build configuration and compiler can affect the final binary hash. The
security review therefore verifies the supplied release executable separately
against the official release and the deterministic binary transformation.

After building, use the produced upscayl-bin.exe as the native backend and
name the distributed copy velune-engine.exe.

## Applying the patch to a clean checkout

For a clean checkout of the exact upstream commit:

```text
git checkout 22774bc42e2bc3c785b5b585d213d960b1348ad5
git submodule update --init --recursive
git apply --check avelune-engine-source.patch
git apply avelune-engine-source.patch
```

The patch must change only the two documented string literals.