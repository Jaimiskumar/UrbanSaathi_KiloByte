import cv2
import numpy as np
from typing import Dict, Optional, Tuple

class PlatePreprocessor:
    """
    OpenCV Multi-Variant Preprocessing specifically designed for License Plate Recognition.
    Produces 12 distinct variations:
    1. Original
    2. Grayscale
    3. 3x upscaled grayscale
    4. 4x upscaled grayscale
    5. CLAHE
    6. CLAHE + sharpen
    7. Otsu
    8. Adaptive threshold
    9. Binary inverse
    10. Denoised + threshold
    11. Sharpened + contrast
    12. Unsharp mask
    """

    @staticmethod
    def deskew_and_correct_perspective(plate_crop: np.ndarray) -> np.ndarray:
        """
        Optional perspective / deskew correction:
        If the plate has quadrilateral contours with 4 corners, warp to rectangular perspective.
        Falls back cleanly to the padded crop if corners cannot be reliably detected.
        """
        if plate_crop is None or plate_crop.size == 0:
            return plate_crop

        h, w = plate_crop.shape[:2]
        if h < 10 or w < 20:
            return plate_crop

        try:
            gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY) if len(plate_crop.shape) == 3 else plate_crop
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(blurred, 50, 150)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return plate_crop

            # Find largest quadrilateral contour
            contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
            plate_quad = None
            for cnt in contours:
                peri = cv2.arcLength(cnt, True)
                approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
                if len(approx) == 4 and cv2.isContourConvex(approx):
                    area = cv2.contourArea(approx)
                    if area > (w * h * 0.45):
                        plate_quad = approx.reshape(4, 2)
                        break

            if plate_quad is None:
                return plate_crop

            # Order points: top-left, top-right, bottom-right, bottom-left
            rect = np.zeros((4, 2), dtype="float32")
            s = plate_quad.sum(axis=1)
            rect[0] = plate_quad[np.argmin(s)]
            rect[2] = plate_quad[np.argmax(s)]

            diff = np.diff(plate_quad, axis=1)
            rect[1] = plate_quad[np.argmin(diff)]
            rect[3] = plate_quad[np.argmax(diff)]

            (tl, tr, br, bl) = rect
            widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
            widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
            maxWidth = max(int(widthA), int(widthB))

            heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
            heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
            maxHeight = max(int(heightA), int(heightB))

            if maxWidth < 20 or maxHeight < 10:
                return plate_crop

            dst = np.array([
                [0, 0],
                [maxWidth - 1, 0],
                [maxWidth - 1, maxHeight - 1],
                [0, maxHeight - 1]
            ], dtype="float32")

            M = cv2.getPerspectiveTransform(rect, dst)
            warped = cv2.warpPerspective(plate_crop, M, (maxWidth, maxHeight))
            return warped
        except Exception:
            return plate_crop

    @staticmethod
    def generate_variants(plate_crop: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Generate 12 plate-specific variations for OCR recognition:
        1. original
        2. grayscale
        3. upscaled_3x
        4. upscaled_4x
        5. clahe
        6. clahe_sharpen
        7. otsu
        8. adaptive_threshold
        9. binary_inverse
        10. denoised_threshold
        11. sharpened_contrast
        12. unsharp_mask
        """
        if plate_crop is None or plate_crop.size == 0:
            return {}

        variants = {}

        # 1. Original
        variants["original"] = plate_crop.copy()

        # 2. Grayscale
        if len(plate_crop.shape) == 3:
            gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
        else:
            gray = plate_crop.copy()
        variants["grayscale"] = gray

        h, w = gray.shape[:2]

        # 3. 3x upscaled grayscale (INTER_CUBIC)
        upscaled_3x = cv2.resize(gray, (w * 3, h * 3), interpolation=cv2.INTER_CUBIC)
        variants["upscaled_3x"] = upscaled_3x

        # 4. 4x upscaled grayscale (INTER_LANCZOS4)
        upscaled_4x = cv2.resize(gray, (w * 4, h * 4), interpolation=cv2.INTER_LANCZOS4)
        variants["upscaled_4x"] = upscaled_4x

        # 5. CLAHE (Contrast Limited Adaptive Histogram Equalization on upscaled_3x)
        clahe_obj = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        clahe_img = clahe_obj.apply(upscaled_3x)
        variants["clahe"] = clahe_img

        # 6. CLAHE + sharpen
        sharpen_kernel = np.array([
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0]
        ], dtype=np.float32)
        clahe_sharpen = cv2.filter2D(clahe_img, -1, sharpen_kernel)
        variants["clahe_sharpen"] = clahe_sharpen

        # Denoised base for binarizations
        denoised = cv2.bilateralFilter(clahe_img, 9, 75, 75)

        # 7. Otsu
        _, otsu = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants["otsu"] = otsu

        # 8. Adaptive threshold
        adaptive = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            21,
            9
        )
        variants["adaptive_threshold"] = adaptive

        # 9. Binary inverse
        binary_inv = cv2.bitwise_not(otsu)
        variants["binary_inverse"] = binary_inv

        # 10. Denoised + threshold
        denoised_blur = cv2.GaussianBlur(upscaled_3x, (5, 5), 0)
        _, denoise_thresh = cv2.threshold(denoised_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants["denoised_threshold"] = denoise_thresh

        # 11. Sharpened + contrast (Unsharp / High-pass enhancement)
        contrast_boost = cv2.convertScaleAbs(upscaled_3x, alpha=1.3, beta=10)
        sharpened_contrast = cv2.filter2D(contrast_boost, -1, sharpen_kernel)
        variants["sharpened_contrast"] = sharpened_contrast

        # 12. Unsharp mask
        gaussian = cv2.GaussianBlur(upscaled_3x, (0, 0), 2.0)
        unsharp = cv2.addWeighted(upscaled_3x, 1.5, gaussian, -0.5, 0)
        variants["unsharp_mask"] = unsharp

        return variants
