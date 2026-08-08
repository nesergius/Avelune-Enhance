import argparse
import os
import sys
import cv2
import numpy as np
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
from gfpgan import GFPGANer


def progress(value, text):
    print(f"AVELUNE_PROGRESS:{value}:{text}", flush=True)


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
        result = gray_world_balance(result, 0.28 if quality == 'faithful' else 0.38)
        result = clahe_luminance(result, 1.25 if quality == 'faithful' else 1.55, 0.35 if quality == 'faithful' else 0.50)

    if metrics['noise'] > 6.2 or metrics['blockiness'] > 7.0:
        h = {'faithful': 3, 'balanced': 5, 'maximum': 6}[quality]
        result = cv2.fastNlMeansDenoisingColored(result, None, h, h, 7, 21)

    return result, metrics, 'photo-restore'


def professional_finish(image, quality, metrics):
    if looks_graphic(metrics):
        return image
    amount = {'faithful': 0.10, 'balanced': 0.16, 'maximum': 0.20}[quality]
    blurred = cv2.GaussianBlur(image, (0, 0), 1.0)
    return np.clip(cv2.addWeighted(image, 1.0 + amount, blurred, -amount, 0), 0, 255).astype(np.uint8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--models', required=True)
    parser.add_argument('--strength', type=float, default=0.75)
    parser.add_argument('--scale', type=float, default=2.0)
    parser.add_argument('--tile', type=int, default=0)
    parser.add_argument('--quality', choices=['faithful', 'balanced', 'maximum'], default='balanced')
    args = parser.parse_args()
    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)

    if not os.path.isfile(input_path):
        raise FileNotFoundError(input_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    models_dir = os.path.abspath(args.models)
    face_weights = os.path.join(models_dir, 'gfpgan', 'weights')
    for name in ('detection_Resnet50_Final.pth', 'parsing_parsenet.pth'):
        candidate = os.path.join(face_weights, name)
        if not os.path.isfile(candidate):
            raise FileNotFoundError(candidate)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    progress(5, f'Инициализация локальной нейросети ({device.upper()})')

    rrdb = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    bg = RealESRGANer(
        scale=4,
        model_path=os.path.join(models_dir, 'RealESRGAN_x4plus.pth'),
        model=rrdb,
        tile=max(0, args.tile),
        tile_pad=10,
        pre_pad=0,
        half=(device == 'cuda'),
        device=torch.device(device),
    )
    previous_cwd = os.getcwd()
    try:
        os.chdir(models_dir)
        restorer = GFPGANer(
            model_path=os.path.join(models_dir, 'GFPGANv1.4.pth'),
            upscale=max(1, int(round(args.scale))),
            arch='clean',
            channel_multiplier=2,
            bg_upsampler=bg,
            device=torch.device(device),
        )

        image = cv2.imread(input_path, cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError('Не удалось декодировать исходное изображение.')
        image, metrics, preprocess_mode = professional_preprocess(image, args.quality)
        progress(12, f'Professional preprocessing: {preprocess_mode}')
        progress(18, 'Поиск и выравнивание лиц')
        quality_caps = {'faithful': 0.55, 'balanced': 0.75, 'maximum': 0.90}
        requested_strength = max(0.0, min(1.0, args.strength))
        face_weight = min(quality_caps[args.quality], max(0.25, requested_strength))
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
        raise RuntimeError('GFPGAN не создал результат.')
    restored = professional_finish(restored, args.quality, metrics)
    progress(92, 'Сохранение восстановленного изображения')
    if not cv2.imwrite(output_path, restored):
        raise RuntimeError('Не удалось сохранить результат.')
    progress(100, 'Готово')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'AVELUNE_ERROR:{exc}', file=sys.stderr, flush=True)
        raise
