import os
import sys
import argparse
import glob
import json
from .pipeline import ALPRPipeline
from .video_processor import VideoALPRProcessor


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

def run_image_mode(pipeline: ALPRPipeline, image_path: str, output_dir: str):
    print(f"\n--- Processing Single Image: {image_path} ---")
    result = pipeline.process_image(image_path, output_dir=output_dir, save_visuals=True)
    print(json.dumps(result, indent=2))
    print(f"\nResults saved under: {output_dir}/")
    return result


def run_folder_mode(pipeline: ALPRPipeline, folder_path: str, output_dir: str):
    print(f"\n--- Processing Image Folder: {folder_path} ---")
    if not os.path.exists(folder_path):
        print(f"Error: Folder not found: {folder_path}")
        sys.exit(1)

    files = [
        f for f in glob.glob(os.path.join(folder_path, "*"))
        if os.path.splitext(f)[1].lower() in IMAGE_EXTENSIONS
    ]

    if not files:
        print(f"No image files found in {folder_path}")
        return []

    print(f"Found {len(files)} images to process...")
    all_results = []
    for f in sorted(files):
        print(f"-> Processing {os.path.basename(f)}...")
        res = pipeline.process_image(f, output_dir=output_dir, save_visuals=True)
        all_results.append(res)

    print(f"\nFolder batch complete. Processed {len(files)} images.")
    print(f"Results and CSV written to: {output_dir}/")
    return all_results


def run_video_mode(pipeline: ALPRPipeline, video_path: str, output_dir: str, output_video: str = None):
    print(f"\n--- Processing Video: {video_path} ---")
    if not output_video:
        base = os.path.splitext(os.path.basename(video_path))[0]
        output_video = os.path.join(output_dir, f"{base}_annotated.mp4")

    v_processor = VideoALPRProcessor(pipeline=pipeline)
    summary = v_processor.process_video(video_path, output_video_path=output_video, output_dir=output_dir)
    print(json.dumps(summary, indent=2))
    return summary


def run_test_mode(pipeline: ALPRPipeline, folder_path: str, output_dir: str):
    """
    Test mode: Processes a folder and outputs a comprehensive statistical report:
    - total images
    - total plates detected
    - total plates successfully OCR'd
    - unreadable plates
    - average detection confidence
    - average OCR confidence
    """
    print(f"\n=======================================================")
    print(f"   URBANSAATHI ALPR BENCHMARK / TEST HARNESS")
    print(f"=======================================================")
    print(f"Target folder: {folder_path}\n")

    results = run_folder_mode(pipeline, folder_path, output_dir)
    total_images = len(results)
    total_plates_detected = 0
    total_plates_ocrd = 0
    unreadable_plates = 0

    det_confs = []
    ocr_confs = []

    for r in results:
        for p in r.get("plates", []):
            total_plates_detected += 1
            det_confs.append(p.get("detection_confidence", 0.0))
            if p.get("status") == "recognized":
                total_plates_ocrd += 1
                ocr_confs.append(p.get("ocr_confidence", 0.0))
            else:
                unreadable_plates += 1

    avg_det_conf = (sum(det_confs) / len(det_confs)) if det_confs else 0.0
    avg_ocr_conf = (sum(ocr_confs) / len(ocr_confs)) if ocr_confs else 0.0
    success_rate = (total_plates_ocrd / total_plates_detected * 100.0) if total_plates_detected > 0 else 0.0

    print("\n=======================================================")
    print("                 FINAL TEST REPORT")
    print("=======================================================")
    print(f"Total images evaluated:           {total_images}")
    print(f"Total plates detected:            {total_plates_detected}")
    print(f"Total plates successfully OCR'd:  {total_plates_ocrd} ({success_rate:.1f}%)")
    print(f"Unreadable plates:                {unreadable_plates}")
    print(f"Average detection confidence:     {avg_det_conf:.4f}")
    print(f"Average OCR confidence:           {avg_ocr_conf:.4f}")
    print("=======================================================")
    print(f"Annotated crops & CSV saved to: {output_dir}/")


def main():
    parser = argparse.ArgumentParser(description="UrbanSaathi Complete License Plate Recognition (ALPR/ANPR)")
    parser.add_argument("--image", type=str, help="Path to single image file")
    parser.add_argument("--folder", type=str, help="Path to folder containing images")
    parser.add_argument("--video", type=str, help="Path to video file")
    parser.add_argument("--test", type=str, help="Run evaluation/test benchmark on folder")
    parser.add_argument("--model", type=str, default="models/real/plate_detector_yolov8n.pt", help="Path to YOLOv8n detector")
    parser.add_argument("--conf", type=float, default=0.25, help="YOLO detection confidence threshold (default: 0.25)")
    parser.add_argument("--ocr-engine", type=str, default="tesseract", choices=["tesseract", "easyocr"], help="OCR engine to use")
    parser.add_argument("--output-dir", type=str, default="outputs", help="Directory to save outputs")
    parser.add_argument("--device", type=str, default=None, help="Device to use (cuda/cpu)")

    args = parser.parse_args()

    # Instantiate pipeline once
    pipeline = ALPRPipeline(
        model_path=args.model,
        conf_thresh=args.conf,
        ocr_engine=args.ocr_engine,
        device=args.device
    )

    if args.image:
        run_image_mode(pipeline, args.image, args.output_dir)
    elif args.folder:
        run_folder_mode(pipeline, args.folder, args.output_dir)
    elif args.video:
        run_video_mode(pipeline, args.video, args.output_dir)
    elif args.test:
        run_test_mode(pipeline, args.test, args.output_dir)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
