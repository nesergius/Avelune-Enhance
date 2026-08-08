# Avelune Enhance native engine — Corresponding Source

Status: **complete for the reviewed native-engine modifications**

The distributed native executable is based on the official Upscayl NCNN backend release `upscayl-bin-20240601-103425`, commit `22774bc42e2bc3c785b5b585d213d960b1348ad5`.

The review confirmed that the Avelune executable changes only two user-visible strings. The executable code section is unchanged. A source-level patch, the exact upstream source with all submodules, build instructions, deterministic binary-transformation evidence and a portable file manifest are included under `native-engine-source`.

The corresponding-source archive for RC6 is `native-engine-source/Avelune-Native-Engine-Corresponding-Source-2.0.0-RC6.zip`. The executable is distributed as `avelune-engine.exe`; the upstream help string inside `src/main.cpp` is changed from `upscayl-bin` to `avelune-bin`, matching the reviewed binary patch.

This status does not by itself approve the complete application for public release. Final security scans and Authenticode signing are tracked separately.
