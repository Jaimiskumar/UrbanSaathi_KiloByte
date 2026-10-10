import re
from typing import Dict, Any

# Valid State/UT Codes for India
INDIAN_STATES = {
    "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA",
    "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD", "MH",
    "ML", "MN", "MP", "MZ", "NL", "OD", "PB", "PY", "RJ", "SK",
    "TN", "TR", "TS", "UK", "UP", "WB", "AN", "OR", "UT"
}

def normalize_plate(raw_text: str) -> str:
    """
    Standardize Indian license plate characters:
    - Upper case
    - Remove spaces, hyphens, dots, special characters
    - Strip OCR artifacts
    - Strip national prefix 'IND' if present at beginning (High Security Registration Plates)
    - Apply conservative positional character correction (NOT global replacements)
    """
    if not raw_text:
        return ""

    # Convert to uppercase
    text = str(raw_text).upper().strip()

    # Retain only letters and numbers
    text = re.sub(r'[^A-Z0-9]', '', text)

    # 1. High Security Registration Plate (HSRP) national stamp prefix removal
    # e.g. 'IND22BH6517A' -> '22BH6517A', 'INDKA05MN9876' -> 'KA05MN9876'
    if text.startswith('IND') and len(text) >= 7:
        text = text[3:]

    # 2. Conservative positional character correction based on plate format
    # Case A: Bharat Series (BH) candidate: starts with 2 digits or looks like \d{2}BH\d{4}[A-Z]{1,2}
    # Pattern: YY BH NNNN AA (e.g. 22BH6517A)
    # Check if chars 2:4 are 'BH' or '8H' or 'B4'
    if len(text) >= 8:
        # Check if positions 2:4 resemble 'BH'
        middle_tag = text[2:4]
        if middle_tag in ("BH", "8H", "B#", "8#") or (text[2] in ('B', '8') and text[3] in ('H', '4')):
            chars = list(text)
            # Positions 0 and 1 MUST be digits (year of registration)
            for idx in [0, 1]:
                if chars[idx] == 'O' or chars[idx] == 'D' or chars[idx] == 'Q':
                    chars[idx] = '0'
                elif chars[idx] == 'I' or chars[idx] == 'L' or chars[idx] == 'T':
                    chars[idx] = '1'
                elif chars[idx] == 'Z':
                    chars[idx] = '2'
                elif chars[idx] == 'S':
                    chars[idx] = '5'
                elif chars[idx] == 'G':
                    chars[idx] = '6'
                elif chars[idx] == 'B':
                    chars[idx] = '8'

            # Positions 2 and 3 MUST be 'BH'
            chars[2] = 'B'
            chars[3] = 'H'

            # Positions 4, 5, 6, 7 MUST be digits (4-digit sequence number)
            for idx in range(4, min(8, len(chars))):
                if chars[idx] == 'O' or chars[idx] == 'D' or chars[idx] == 'Q':
                    chars[idx] = '0'
                elif chars[idx] == 'I' or chars[idx] == 'L' or chars[idx] == 'T':
                    chars[idx] = '1'
                elif chars[idx] == 'Z':
                    chars[idx] = '2'
                elif chars[idx] == 'A':
                    chars[idx] = '4'
                elif chars[idx] == 'S':
                    chars[idx] = '5'
                elif chars[idx] == 'G':
                    chars[idx] = '6'
                elif chars[idx] == 'B':
                    chars[idx] = '8'

            # Positions 8+ (if present) MUST be letters (1-2 letters series)
            for idx in range(8, len(chars)):
                if chars[idx] == '0':
                    chars[idx] = 'O'
                elif chars[idx] == '1':
                    chars[idx] = 'I'
                elif chars[idx] == '2':
                    chars[idx] = 'Z'
                elif chars[idx] == '5':
                    chars[idx] = 'S'
                elif chars[idx] == '8':
                    chars[idx] = 'B'

            return "".join(chars)

    # Case B: Standard State Plate (e.g. DL01AB1234, KA05MN9876, UP64W4388)
    if len(text) >= 6:
        # Check if first 2 characters resemble a known state code
        state_cand = list(text[:2])
        if state_cand[0] == '0':
            state_cand[0] = 'O'
        elif state_cand[0] == '1':
            state_cand[0] = 'I'
        if state_cand[1] == '0':
            state_cand[1] = 'O'
        elif state_cand[1] == '1':
            state_cand[1] = 'I'

        potential_state = "".join(state_cand)
        if potential_state in INDIAN_STATES:
            chars = list(text)
            chars[0], chars[1] = state_cand[0], state_cand[1]

            # Next 1 or 2 characters are RTO district digits
            rto_end = 4 if (len(chars) >= 4 and (chars[3].isdigit() or chars[3] in ('O', 'I', 'Z', 'S', 'G', 'B', 'A'))) else 3
            for idx in range(2, min(rto_end, len(chars))):
                if chars[idx] == 'O' or chars[idx] == 'D':
                    chars[idx] = '0'
                elif chars[idx] == 'I' or chars[idx] == 'L':
                    chars[idx] = '1'
                elif chars[idx] == 'Z':
                    chars[idx] = '2'
                elif chars[idx] == 'A':
                    chars[idx] = '4'
                elif chars[idx] == 'S':
                    chars[idx] = '5'
                elif chars[idx] == 'G':
                    chars[idx] = '6'
                elif chars[idx] == 'B':
                    chars[idx] = '8'

            # Last 4 characters (if length >= 8) are registration digits
            if len(chars) >= 8:
                for idx in range(len(chars) - 4, len(chars)):
                    if chars[idx] == 'O' or chars[idx] == 'D':
                        chars[idx] = '0'
                    elif chars[idx] == 'I' or chars[idx] == 'L':
                        chars[idx] = '1'
                    elif chars[idx] == 'Z':
                        chars[idx] = '2'
                    elif chars[idx] == 'A':
                        chars[idx] = '4'
                    elif chars[idx] == 'S':
                        chars[idx] = '5'
                    elif chars[idx] == 'G':
                        chars[idx] = '6'
                    elif chars[idx] == 'B':
                        chars[idx] = '8'

            return "".join(chars)

    return text


def validate_indian_plate(text: str) -> Dict[str, Any]:
    """
    Computes a format plausibility score (0.0 to 1.0) rather than a rigid rejection.
    Recognizes:
    - Bharat (BH) Series: YYBHNNNNAA or YYBHNNNNA (e.g. 22BH6517A)
    - Standard Indian: SS DD SSS NNNN (e.g. KA05MN9876, UP64W4388)
    - Diplomatic / Defense / Commercial
    - Plausible alphanumeric plates
    """
    clean_text = normalize_plate(text)
    if not clean_text or len(clean_text) < 4:
        return {
            "format_confidence": 0.10,
            "format_type": "invalid_length",
            "is_valid_structure": False,
            "state_code": None
        }

    # 1. Bharat (BH) Series Format (e.g. 22BH6517A, 21BH2345AA)
    # Pattern: Year(2) + BH + Number(4) + Series(1-2)
    bh_match = re.match(r'^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$', clean_text)
    if bh_match:
        return {
            "format_confidence": 0.98,
            "format_type": "bharat_series",
            "is_valid_structure": True,
            "state_code": "BH"
        }

    # Partial BH series (e.g. 22BH6517 without series letter yet)
    if re.match(r'^([0-9]{2})(BH)([0-9]{4})$', clean_text):
        return {
            "format_confidence": 0.92,
            "format_type": "bharat_series_partial",
            "is_valid_structure": True,
            "state_code": "BH"
        }

    # 2. Standard Indian Registration Format (e.g. DL01AB1234, MH12DE1433, KA05A9999, UP64W4388)
    # Pattern: State(2) + District(1-2) + Series(0-3) + Number(1-4)
    std_match = re.match(r'^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{1,4})$', clean_text)
    if std_match:
        state, rto, series, num = std_match.groups()
        score = 0.85
        if state in INDIAN_STATES:
            score += 0.10  # Valid State/UT bonus
        if len(num) == 4:
            score += 0.05  # Standard 4-digit registration bonus
        return {
            "format_confidence": round(min(1.0, score), 4),
            "format_type": "standard_indian",
            "is_valid_structure": True,
            "state_code": state
        }

    # 3. Diplomatic / Commercial / Vintage / Defense formats
    if re.match(r'^[0-9]{1,3}(CD|CC|UN)[0-9]{1,4}$', clean_text):
        return {
            "format_confidence": 0.90,
            "format_type": "diplomatic",
            "is_valid_structure": True,
            "state_code": "CD"
        }

    # 4. State + alphanumeric without strict subfield partitions (length between 7 and 10)
    first_two = clean_text[:2]
    has_letters = bool(re.search(r'[A-Z]', clean_text))
    has_digits = bool(re.search(r'[0-9]', clean_text))

    if first_two in INDIAN_STATES and has_letters and has_digits and (7 <= len(clean_text) <= 10):
        return {
            "format_confidence": 0.80,
            "format_type": "partial_state_matched",
            "is_valid_structure": True,
            "state_code": first_two
        }

    # 5. General plausible alphanumeric plate (8-10 characters, contains both letters and numbers)
    if has_letters and has_digits and (8 <= len(clean_text) <= 10):
        return {
            "format_confidence": 0.70,
            "format_type": "alphanumeric_plausible",
            "is_valid_structure": True,
            "state_code": None
        }

    if has_letters and has_digits and (6 <= len(clean_text) <= 11):
        return {
            "format_confidence": 0.50,
            "format_type": "alphanumeric_partial",
            "is_valid_structure": False,
            "state_code": None
        }

    # 6. Low plausibility / noise
    return {
        "format_confidence": 0.20,
        "format_type": "unrecognized_pattern",
        "is_valid_structure": False,
        "state_code": None
    }


def format_plate(clean_text: str) -> str:
    """
    Format normalized plate string into human-readable spaced representation:
    - Bharat Series: 22BH6517A -> '22 BH 6517 A'
    - Standard Indian: KA05MN9876 -> 'KA 05 MN 9876'
    - Standard 2-digit RTO: UP64W4388 -> 'UP 64 W 4388'
    """
    s = re.sub(r'[^A-Z0-9]', '', str(clean_text).upper())
    # Bharat Series: 2 digits + BH + 4 digits + 1-2 letters
    m_bh = re.match(r'^(\d{2})(BH)(\d{4})([A-Z]{1,2})$', s)
    if m_bh:
        return f"{m_bh.group(1)} {m_bh.group(2)} {m_bh.group(3)} {m_bh.group(4)}"
    m_bh_partial = re.match(r'^(\d{2})(BH)(\d{4})$', s)
    if m_bh_partial:
        return f"{m_bh_partial.group(1)} {m_bh_partial.group(2)} {m_bh_partial.group(3)}"
    # Standard Indian: 2 letters + 1-2 digits + 0-3 letters + 4 digits
    m_std = re.match(r'^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$', s)
    if m_std:
        parts = [p for p in m_std.groups() if p]
        return " ".join(parts)
    return s

