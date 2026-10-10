import os
import shutil
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import numpy as np

# Try importing pytesseract
try:
    import pytesseract
    from pytesseract import Output
    PYTESSERACT_AVAILABLE = True
except ImportError:
    pytesseract = None
    Output = None
    PYTESSERACT_AVAILABLE = False

# Try importing easyocr for modular alternative/fallback
try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    easyocr = None
    EASYOCR_AVAILABLE = False


class BaseOCREngine(ABC):
    """
    Abstract Modular Base OCR Engine.
    Permits swapping Tesseract with EasyOCR, PaddleOCR, or dedicated plate models
    without rewriting the detection pipeline.
    """
    @abstractmethod
    def recognize_plate(self, plate_image: np.ndarray, psm: int = 7) -> Dict[str, Any]:
        """
        Recognizes characters on a cropped plate image variant.
        Returns:
            {
                "text": str,
                "confidence": float (0.0 to 1.0)
            }
        """
        pass


class TesseractEngine(BaseOCREngine):
    """
    Tesseract OCR Engine configured with alphanumeric whitelist and multi-PSM support.
    """
    DEFAULT_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

    def __init__(self, tesseract_cmd: Optional[str] = None):
        if not PYTESSERACT_AVAILABLE:
            raise ImportError("pytesseract is not installed. Please run: pip install pytesseract")

        # Auto-detect Tesseract binary on Windows or system PATH
        candidate_paths = [
            tesseract_cmd,
            os.environ.get("TESSERACT_PATH"),
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
            shutil.which("tesseract")
        ]

        found_path = None
        for p in candidate_paths:
            if p and os.path.exists(p) and not os.path.isdir(p):
                found_path = p
                break

        if found_path:
            pytesseract.pytesseract.tesseract_cmd = found_path
            self.binary_path = found_path
        elif shutil.which("tesseract"):
            self.binary_path = "tesseract"
        else:
            self.binary_path = None

    def is_available(self) -> bool:
        return self.binary_path is not None

    def recognize_plate(self, plate_image: np.ndarray, psm: int = 7) -> Dict[str, Any]:
        if not self.is_available():
            return {
                "text": "",
                "confidence": 0.0,
                "error": "Tesseract binary not found."
            }

        if plate_image is None or plate_image.size == 0:
            return {"text": "", "confidence": 0.0}

        config = f"--oem 3 --psm {psm} -c tessedit_char_whitelist={self.DEFAULT_WHITELIST}"

        try:
            data = pytesseract.image_to_data(plate_image, config=config, output_type=Output.DICT)
            n_boxes = len(data['text'])
            collected_chars = []
            confidences = []

            for i in range(n_boxes):
                word = data['text'][i].strip()
                conf_val = float(data['conf'][i])
                if word and conf_val >= 0:
                    collected_chars.append(word)
                    confidences.append(conf_val)

            recognized_text = "".join(collected_chars).strip()
            avg_conf = (sum(confidences) / len(confidences) / 100.0) if confidences else 0.0

            return {
                "text": recognized_text,
                "confidence": round(avg_conf, 4)
            }
        except Exception as e:
            return {
                "text": "",
                "confidence": 0.0,
                "error": str(e)
            }


class EasyOCREngine(BaseOCREngine):
    """
    Modular EasyOCR Engine implementation with multi-line/subfield parsing.
    Handles PSM parameter gracefully for uniform interface.
    """
    _reader_instance = None

    def __init__(self, lang_list=None, gpu: bool = False):
        if not EASYOCR_AVAILABLE:
            raise ImportError("easyocr is not installed.")
        if EasyOCREngine._reader_instance is None:
            if lang_list is None:
                lang_list = ['en']
            EasyOCREngine._reader_instance = easyocr.Reader(lang_list, gpu=gpu, verbose=False)
        self.reader = EasyOCREngine._reader_instance

    def recognize_plate(self, plate_image: np.ndarray, psm: int = 7) -> Dict[str, Any]:
        if plate_image is None or plate_image.size == 0:
            return {"text": "", "confidence": 0.0}

        try:
            # EasyOCR detail=1 returns list of [bbox, text, conf]
            # Paragraph mode toggled based on PSM hint
            paragraph_mode = (psm in (6, 11, 13))
            results = self.reader.readtext(
                plate_image,
                allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                paragraph=paragraph_mode
            )
            if not results:
                return {"text": "", "confidence": 0.0}

            # If multiple segments detected (e.g. 'IND', '22BH6517A'), sort left-to-right
            # item: (bbox, text, conf)
            sorted_items = sorted(results, key=lambda it: min(pt[0] for pt in it[0]))

            texts = []
            confs = []
            for item in sorted_items:
                text = str(item[1]).strip()
                c = float(item[2])
                if text:
                    texts.append(text)
                    confs.append(c)

            # Filter out standalone 'IND' if there is another plate component
            if len(texts) > 1 and texts[0].upper() == 'IND':
                texts = texts[1:]
                confs = confs[1:]

            plate_text = "".join(texts).strip()
            avg_conf = sum(confs) / len(confs) if confs else 0.0
            return {
                "text": plate_text,
                "confidence": round(avg_conf, 4)
            }
        except Exception as e:
            return {
                "text": "",
                "confidence": 0.0,
                "error": str(e)
            }


def get_ocr_engine(engine_name: str = "tesseract", fallback_if_unavailable: bool = True) -> BaseOCREngine:
    """
    Factory to retrieve an OCR engine instance.
    If 'tesseract' is requested but binary is not found, cleanly falls back to EasyOCR.
    """
    if engine_name.lower() == "tesseract":
        engine = TesseractEngine()
        if not engine.is_available() and fallback_if_unavailable and EASYOCR_AVAILABLE:
            print("[OCR Factory] Tesseract binary not on PATH. Utilizing EasyOCR engine.")
            return EasyOCREngine()
        return engine
    elif engine_name.lower() == "easyocr":
        return EasyOCREngine()
    else:
        raise ValueError(f"Unknown OCR engine: {engine_name}")
