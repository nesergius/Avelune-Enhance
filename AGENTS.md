# Avelune Enhance --- Codex Development Guide

## Project Overview

Avelune Enhance is a local Windows AI image enhancement application.

Technology: - Electron - React - Node.js - GPU acceleration -
electron-builder

## Core Rules

-   Preserve existing architecture.
-   Do not remove working AI integrations.
-   Keep IPC compatibility.
-   Prefer incremental fixes.

## AI Profiles

### Natural 4x

Real-ESRGAN x4plus. Natural photo enhancement.

### Neural Restore

GFPGAN + RealESRNet. Old photos, faces, JPEG artifact restoration.

### Photo Restore Ultra

DiffBIR + GFPGAN + Real-ESRGAN. Maximum quality restoration.

### Art & Anime

Anime and illustration enhancement.

## UI Rules

Windows Studio premium style: - clean; - professional; - SVG icons; -
clear hierarchy.

Avoid: - placeholder images; - unnecessary neon; - clutter.

## AI Profile Cards

Display: - icon; - name; - description; - quality; - speed; - VRAM; -
backend models.

## AI Package Manager

Validate progress values before PowerShell conversion.

Accept: - 50 - "50" - "50%" - null

Normalize to integer 0-100.

## QA

Keep required marker:

`profile-preview-divider`

Run visual QA, performance QA and packaging tests.

## Current Priorities

1.  Fix AI Package Manager.
2.  Complete Windows Studio AI Profile Selector.
3.  Improve restoration pipeline.
4.  Fix scrollPerformancePassed.
5.  Prepare RC release.
