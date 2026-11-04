"""
DinoMate Autonomous Video Assembler
Assembles 1080x1920 9:16 vertical video reels from scene images with smooth transitions.
Uses OpenCV (cv2) for cross-platform, dependency-free MP4 video rendering.
"""

import sys
import os
import json
import cv2
import numpy as np

def create_reel_video(
    image_paths: list[str],
    output_path: str,
    fps: int = 24,
    scene_durations: list[float] = None,
    transition_frames: int = 12
):
    """
    Stitches multiple scene images into a smooth 1080x1920 vertical MP4 video.
    Includes subtle Ken Burns zoom motion and cross-dissolve transitions between scenes.
    """
    if not image_paths:
        raise ValueError("No images provided for video generation")

    target_w, target_h = 1080, 1920

    # Default durations per scene strictly calibrated for 15-20 second reels:
    # Scene 1 (Hook): 3.5s
    # Scene 2 (Eligibility): 3.5s
    # Scene 3 (Skills): 3.5s
    # Scene 4 (Salary): 3.5s
    # Scene 5 (CTA): 3.0s
    # Total = 17.0s
    if not scene_durations or len(scene_durations) != len(image_paths):
        scene_durations = [3.5, 3.5, 3.5, 3.5, 3.0][:len(image_paths)]
        while len(scene_durations) < len(image_paths):
            scene_durations.append(3.5)

    # Enforce strict 15-20 second total reel duration constraint
    total_d = sum(scene_durations)
    if total_d > 20.0 or total_d < 15.0:
        target_total = 17.5
        scale = target_total / total_d
        scene_durations = [round(d * scale, 2) for d in scene_durations]

    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # Load and resize images to 1080x1920
    loaded_images = []
    for path in image_paths:
        if not os.path.exists(path):
            raise FileNotFoundError(f"Image frame not found: {path}")
        img = cv2.imread(path)
        if img is None:
            raise ValueError(f"Failed to read image at: {path}")
        if (img.shape[1], img.shape[0]) != (target_w, target_h):
            img = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
        loaded_images.append(img)

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(output_path, fourcc, fps, (target_w, target_h))

    if not writer.isOpened():
        raise RuntimeError(f"Could not open VideoWriter for output: {output_path}")

    total_frames = 0

    for idx, img in enumerate(loaded_images):
        scene_time = scene_durations[idx]
        num_frames = int(scene_time * fps)

        # Next image for cross-dissolve transition if not last scene
        next_img = loaded_images[idx + 1] if idx + 1 < len(loaded_images) else None

        for f in range(num_frames):
            # Subtle zoom effect: scale from 1.0 to 1.03 for dynamic feel
            progress = f / max(num_frames, 1)
            zoom = 1.0 + (0.025 * progress)
            
            # Apply slight center crop and zoom
            crop_w = int(target_w / zoom)
            crop_h = int(target_h / zoom)
            x1 = (target_w - crop_w) // 2
            y1 = (target_h - crop_h) // 2
            cropped = img[y1:y1 + crop_h, x1:x1 + crop_w]
            zoomed_frame = cv2.resize(cropped, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

            # Check if within cross-dissolve transition window at end of scene
            frames_remaining = num_frames - f
            if next_img is not None and frames_remaining <= transition_frames:
                alpha = frames_remaining / float(transition_frames)
                blended = cv2.addWeighted(zoomed_frame, alpha, next_img, 1.0 - alpha, 0)
                writer.write(blended)
            else:
                writer.write(zoomed_frame)

            total_frames += 1

    writer.release()

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise RuntimeError("Video file creation failed or file is empty")

    duration_sec = total_frames / fps
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)

    return {
        "outputPath": output_path,
        "width": target_w,
        "height": target_h,
        "fps": fps,
        "totalFrames": total_frames,
        "durationSec": round(duration_sec, 2),
        "fileSizeBytes": os.path.getsize(output_path),
        "fileSizeMb": round(file_size_mb, 2)
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python stitch_video.py <spec.json>")
        sys.exit(1)

    spec_file = sys.argv[1]
    with open(spec_file, "r", encoding="utf-8") as f:
        config = json.load(f)

    result = create_reel_video(
        image_paths=config["images"],
        output_path=config["output"],
        fps=config.get("fps", 24),
        scene_durations=config.get("durations"),
        transition_frames=config.get("transitionFrames", 12)
    )

    print(json.dumps(result))

