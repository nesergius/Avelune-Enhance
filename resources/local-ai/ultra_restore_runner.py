import argparse
import os
import shutil
import subprocess
import sys
import tempfile

import cv2
import numpy as np
import torch


def progress(value, text):
    print(f"AVELUNE_PROGRESS:{int(value)}:{text}", flush=True)


def clamp(value, low, high):
    return max(low, min(high, value))


def restoration_metrics(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    blur = cv2.GaussianBlur(gray, (0, 0), 1.2)
    h, w = gray.shape[:2]
    vertical = 0.0
    if w > 16:
        right = gray[:, 8::8].astype(np.float32)
        left = gray[:, 7::8].astype(np.float32)
        columns = min(right.shape[1], left.shape[1])
        if columns:
            vertical = float(np.mean(np.abs(right[:, :columns] - left[:, :columns])))
    horizontal = 0.0
    if h > 16:
        bottom = gray[8::8, :].astype(np.float32)
        top = gray[7::8, :].astype(np.float32)
        rows = min(bottom.shape[0], top.shape[0])
        if rows:
            horizontal = float(np.mean(np.abs(bottom[:rows, :] - top[:rows, :])))
    return {
        'noise': float(np.mean(np.abs(gray.astype(np.float32) - blur.astype(np.float32)))),
        'edge': float(np.mean(np.abs(cv2.Laplacian(gray, cv2.CV_32F)))),
        'blockiness': float((vertical + horizontal) / 2.0),
        'saturation': float(np.mean(hsv[:, :, 1]) / 255.0),
        'contrast': float(np.percentile(gray, 95) - np.percentile(gray, 5)),
        'luma': float(np.mean(gray)),
    }


def looks_graphic(metrics):
    return (
        metrics['edge'] > 13.0 and metrics['noise'] < 5.8 and (metrics['saturation'] < 0.18 or metrics['contrast'] > 135)
    ) or (
        metrics['saturation'] > 0.35 and metrics['luma'] < 95 and metrics['edge'] > 18.0 and metrics['noise'] < 10.5
    )


def gray_world_balance(image, strength=0.35):
    work = image.astype(np.float32)
    means = np.maximum(work.reshape(-1, 3).mean(axis=0), 1.0)
    target = float(np.mean(means))
    balanced = np.clip(work * (target / means), 0, 255).astype(np.uint8)
    return cv2.addWeighted(image, 1.0 - strength, balanced, strength, 0)


def clahe_luminance(image, clip=1.4, strength=0.45):
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    luma, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
    enhanced = clahe.apply(luma)
    merged = cv2.merge((cv2.addWeighted(luma, 1.0 - strength, enhanced, strength, 0), a, b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def professional_preprocess(image, quality):
    metrics = restoration_metrics(image)
    if looks_graphic(metrics):
        return image, metrics, 'graphic-safe'

    result = image.copy()
    old_photo = metrics['saturation'] < 0.20 or metrics['contrast'] < 86 or metrics['blockiness'] > 5.5
    if old_photo:
        result = gray_world_balance(result, 0.30 if quality == 'faithful' else 0.42)
        result = clahe_luminance(result, 1.30 if quality == 'faithful' else 1.65, 0.38 if quality == 'faithful' else 0.55)

    if metrics['noise'] > 6.2 or metrics['blockiness'] > 7.0:
        h = {'faithful': 3, 'balanced': 4, 'maximum': 5}[quality]
        result = cv2.fastNlMeansDenoisingColored(result, None, h, h, 7, 21)

    return result, metrics, 'photo-restore'


def professional_finish(image, quality, metrics):
    if looks_graphic(metrics):
        return image
    amount = {'faithful': 0.08, 'balanced': 0.13, 'maximum': 0.16}[quality]
    blurred = cv2.GaussianBlur(image, (0, 0), 1.0)
    return np.clip(cv2.addWeighted(image, 1.0 + amount, blurred, -amount, 0), 0, 255).astype(np.uint8)


def quality_settings(quality, strength):
    base = {
        'faithful': {'steps': 12, 'cfg': 3.0, 'face': 0.50},
        'balanced': {'steps': 28, 'cfg': 5.0, 'face': 0.68},
        'maximum': {'steps': 48, 'cfg': 7.5, 'face': 0.84},
    }[quality]
    strength = clamp(float(strength), 0.0, 1.0)
    return {
        'steps': max(8, int(round(base['steps'] * (0.85 + strength * 0.30)))),
        'cfg': round(base['cfg'] * (0.92 + strength * 0.16), 2),
        'noise': 0,
        'strength': round(clamp(strength, 0.35, 1.0), 2),
        'face': clamp(base['face'] * (0.85 + strength * 0.25), 0.35, 0.90),
    }


def collect_images(root):
    found = []
    for current, _, names in os.walk(root):
        for name in names:
            if name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                found.append(os.path.join(current, name))
    return found


def should_skip_diffbir_progress(text):
    lower = text.lower()
    if lower.startswith('failed to import llava') or lower.startswith('failed to import ram'):
        return True
    if lower in ('use sdp attention as default', 'keep default attention mode'):
        return True
    if 'runtimewarning' in lower or lower.startswith('sqrt_recip'):
        return True
    if 'cond_stage_model.model.' in lower:
        return True
    return 'setting up sdpcrossattention' in lower or 'building sdpattnblock' in lower


def apply_qa_step_override(settings):
    value = os.environ.get('AVELUNE_DIFFBIR_STEPS')
    if not value:
        return settings
    try:
        steps = int(float(value))
    except ValueError:
        return settings
    settings['steps'] = max(2, min(settings['steps'], steps))
    return settings


def run_diffbir(args, input_dir, output_dir, device, precision, settings):
    env = os.environ.copy()
    env['HF_HOME'] = os.path.join(args.models, 'hf-cache')
    env['AVELUNE_DIFFBIR_MODEL'] = os.path.join(args.models, 'DiffBIR_v2.1.pt')
    env['PYTHONPATH'] = args.repo + (os.pathsep + env['PYTHONPATH'] if env.get('PYTHONPATH') else '')

    scale = str(max(1, min(4, int(round(args.scale)))))
    entry = os.path.join(args.repo, 'inference.py')
    bootstrap = (
        "import runpy, sys; "
        "repo = sys.argv.pop(1); "
        "script = sys.argv.pop(1); "
        "sys.path.insert(0, repo); "
        "sys.argv[0] = script; "
        "runpy.run_path(script, run_name='__main__')"
    )
    cmd = [
        sys.executable, '-u', '-c', bootstrap, args.repo, entry,
        '--task', 'sr',
        '--upscale', scale,
        '--version', 'v2.1',
        '--sampler', 'spaced',
        '--steps', str(settings['steps']),
        '--captioner', 'none',
        '--pos_prompt', 'high quality realistic photograph, natural texture, faithful identity, preserved details',
        '--neg_prompt', 'low quality, blurry, noisy, oversharpened, plastic skin, distorted face, false details, weird texture',
        '--cfg_scale', str(settings['cfg']),
        '--noise_aug', str(settings['noise']),
        '--strength', str(settings['strength']),
        '--device', device,
        '--precision', precision,
        '--input', input_dir,
        '--output', output_dir,
    ]
    if args.tile > 0:
        cleaner_tile = max(256, args.tile)
        cleaner_stride = max(128, cleaner_tile // 2)
        vae_tile = max(256, min(512, cleaner_tile))
        cldm_tile = max(512, cleaner_tile)
        cldm_stride = max(256, cldm_tile // 2)
        cmd += [
            '--cleaner_tiled',
            '--cleaner_tile_size', str(cleaner_tile),
            '--cleaner_tile_stride', str(cleaner_stride),
            '--vae_encoder_tiled',
            '--vae_encoder_tile_size', str(vae_tile),
            '--vae_decoder_tiled',
            '--vae_decoder_tile_size', str(vae_tile),
            '--cldm_tiled',
            '--cldm_tile_size', str(cldm_tile),
            '--cldm_tile_stride', str(cldm_stride),
        ]

    progress(12, 'DiffBIR scene restoration')
    proc = subprocess.Popen(cmd, cwd=args.repo, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors='replace')
    line_count = 0
    for line in proc.stdout:
        text = line.strip()
        if text and not should_skip_diffbir_progress(text):
            line_count += 1
            progress(min(86, 18 + line_count * 2), text[-180:])
    if proc.wait() != 0:
        raise RuntimeError('DiffBIR failed')


def apply_face_restore(input_path, output_path, models_dir, device, face_weight):
    import cv2
    from gfpgan import GFPGANer

    models_dir = os.path.abspath(models_dir)
    face_weights = os.path.join(models_dir, 'gfpgan', 'weights')
    for name in ('detection_Resnet50_Final.pth', 'parsing_parsenet.pth'):
        candidate = os.path.join(face_weights, name)
        if not os.path.isfile(candidate):
            raise FileNotFoundError(candidate)

    image = cv2.imread(input_path, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError('Unable to decode DiffBIR output')

    progress(88, 'GFPGAN face refinement')
    previous_cwd = os.getcwd()
    try:
        os.chdir(models_dir)
        restorer = GFPGANer(
            model_path=os.path.join(models_dir, 'GFPGANv1.4.pth'),
            upscale=1,
            arch='clean',
            channel_multiplier=2,
            bg_upsampler=None,
            device=torch.device(device),
        )
        _, _, restored = restorer.enhance(
            image,
            has_aligned=False,
            only_center_face=False,
            paste_back=True,
            weight=face_weight,
        )
    finally:
        os.chdir(previous_cwd)
    if restored is None:
        shutil.copy2(input_path, output_path)
        return
    if not cv2.imwrite(output_path, restored):
        raise RuntimeError('Unable to save GFPGAN output')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--models', required=True)
    parser.add_argument('--repo', required=True)
    parser.add_argument('--strength', type=float, default=.75)
    parser.add_argument('--scale', type=float, default=2)
    parser.add_argument('--tile', type=int, default=0)
    parser.add_argument('--quality', choices=['faithful', 'balanced', 'maximum'], default='balanced')
    args = parser.parse_args()
    args.models = os.path.abspath(args.models)
    args.repo = os.path.abspath(args.repo)
    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)

    if not os.path.isfile(input_path):
        raise FileNotFoundError(input_path)
    if not os.path.isfile(os.path.join(args.repo, 'inference.py')):
        raise FileNotFoundError(os.path.join(args.repo, 'inference.py'))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    settings = apply_qa_step_override(quality_settings(args.quality, args.strength))
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    precision = 'fp16' if device == 'cuda' else 'fp32'
    work = tempfile.mkdtemp(prefix='avelune-diffbir-')
    try:
        input_dir = os.path.join(work, 'input')
        output_dir = os.path.join(work, 'output')
        os.makedirs(input_dir)
        os.makedirs(output_dir)
        progress(4, f'DiffBIR v2.1 init ({device.upper()}, {args.quality})')
        image = cv2.imread(input_path, cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError('Unable to decode input image')
        image, metrics, preprocess_mode = professional_preprocess(image, args.quality)
        progress(6, f'Professional preprocessing: {preprocess_mode}')
        prepared_input = os.path.join(input_dir, os.path.basename(input_path))
        if not cv2.imwrite(prepared_input, image):
            raise RuntimeError('Unable to save preprocessed input')

        run_diffbir(args, input_dir, output_dir, device, precision, settings)

        outputs = collect_images(output_dir)
        if not outputs:
            raise RuntimeError('DiffBIR did not create an image')
        diffbir_output = max(outputs, key=os.path.getmtime)
        face_output = os.path.join(work, 'face-refined.png')
        apply_face_restore(diffbir_output, face_output, args.models, device, settings['face'])
        polished = cv2.imread(face_output, cv2.IMREAD_COLOR)
        if polished is None:
            raise RuntimeError('Unable to decode GFPGAN output')
        polished = professional_finish(polished, args.quality, metrics)
        if not cv2.imwrite(face_output, polished):
            raise RuntimeError('Unable to save Ultra polished output')

        progress(96, 'Saving Ultra result')
        shutil.copy2(face_output, output_path)
        progress(100, 'Done')
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'AVELUNE_ERROR:{exc}', file=sys.stderr, flush=True)
        raise
