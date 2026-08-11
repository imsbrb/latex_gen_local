import json
import os
import re
import difflib
from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from llm_client import PROVIDER, get_client, extraction_model, LOCAL_NUM_CTX

load_dotenv()

DEFAULT_VALUES: dict[str, str] = {
    "columnLayout": "single",
    "lineSpacing": "single",
    "keywordSeparator": "comma",
    "fontFamily": "Times New Roman",
    "referencingStyle": "IEEE",
    "highlights": "no",
    "orcidRequired": "no",
    "documentClass": "article.cls",
}

DEFAULT_NUMERIC_VALUES: dict[str, str] = {
    "marginLeft": "25.4",
    "marginRight": "25.4",
    "marginTop": "25.4",
    "marginBottom": "25.4",
    "fontSizeTitle": "14",
    "fontSizeText": "10",
    "fontSizeFigureCaption": "9",
    "fontSizeTableCaption": "9",
}

ALL_DEFAULTS: dict[str, str] = {**DEFAULT_VALUES, **DEFAULT_NUMERIC_VALUES}

# When true, any field the model failed to produce is filled from the
# defaults above so the frontend always receives a complete set of
# key/value pairs. The field still stays in `unresolved`, so Page2 keeps
# showing its "Not found in guidelines - please verify" note next to it -
# this only guarantees you never get a blank/missing dropdown.
FILL_DEFAULTS = os.getenv("EXTRACTION_FILL_DEFAULTS", "1") not in ("0", "false", "False")

# How many times to re-ask the model when its reply can't be parsed.
MAX_EXTRACTION_ATTEMPTS = int(os.getenv("EXTRACTION_MAX_ATTEMPTS", "3"))

# --- Field keys the model must respond with, one per line -----------------
# Using explicit "Key: value" lines instead of strict JSON mode (per your
# earlier decision) - simple to parse, no schema-lock dependency.

FORMATTING_FIELDS = [
    "columnLayout",       # single | double
    "marginLeft",
    "marginRight",
    "marginTop",
    "marginBottom",
    "lineSpacing",         # single | double
    "fontSizeTitle",
    "fontSizeText",
    "fontSizeFigureCaption",
    "fontSizeTableCaption",
    "fontFamily",
    "keywordSeparator",    # comma | semicolon
    "documentClass",
    "referencingStyle",
    #"highlights",          # yes | no
    "orcidRequired",       # yes | no
]

REQUIREMENT_FLAGS = [
    "dataAvailabilityRequired",
    "fundingStatementRequired",
    "conflictOfInterestRequired",
    "ethicsApprovalRequired",
    "consentForPublicationRequired",
    "authorContributionsRequired",
    "creditStatementRequired",
    "generativeAIRequired",
]

ALL_FIELDS = FORMATTING_FIELDS #+ REQUIREMENT_FLAGS

# Mirrors the exact <option> values in Page2's dropdowns - anything the
# model returns is matched (case-insensitively) against these before being
# accepted, so a mismatch never silently reaches the frontend as a value
# that can't be selected in its <Select>.
ALLOWED_VALUES: dict[str, list[str]] = {
    "columnLayout": ["single", "double"],
    "lineSpacing": ["single", "double"],
    "keywordSeparator": ["comma", "semicolon"],
    "documentClass": ["IEEEtran.cls", "article.cls", "acmart.cls", "elsarticle.cls", "WileyNJDv5.cls", "sn-jnl.cls"],
    "fontFamily": ["Times New Roman", "Arial", "Computer Modern"],
    "referencingStyle": ["APA", "Harvard", "IEEE", "Vancouver", "Numbered", "AuthorYear", "VancouverNumbered", "VancouverAuthorYear", "Chicago", "Basic", "MathPhysNumbered", "MathPhysAuthorYear", "APS", "Nature"],
    "highlights": ["yes", "no"],
    "orcidRequired": ["yes", "no"],
}

# Fields that must end up as a plain number string for Page2's
# <MiniInput type="number">. Guideline text almost always states these
# with a unit ("25mm", "10pt") - HTML number inputs render blank if their
# value isn't a strictly valid number, so units must be stripped here.
MARGIN_FIELDS = [
    "marginLeft",
    "marginRight",
    "marginTop",
    "marginBottom",
]

FONT_SIZE_FIELDS = [
    "fontSizeTitle",
    "fontSizeText",
    "fontSizeFigureCaption",
    "fontSizeTableCaption",
]

NUMERIC_FIELDS = MARGIN_FIELDS + FONT_SIZE_FIELDS

INCH_TO_MM = 25.4
CM_TO_MM = 10.0

# Sanity ranges - a model that hallucinates "marginLeft: 2540" or
# "fontSizeText: 1200" should be treated as not having found the value at
# all rather than pushing a nonsense number into the form.
NUMERIC_RANGES: dict[str, tuple[float, float]] = {
    "marginLeft": (5.0, 100.0),
    "marginRight": (5.0, 100.0),
    "marginTop": (5.0, 100.0),
    "marginBottom": (5.0, 100.0),
    "fontSizeTitle": (6.0, 36.0),
    "fontSizeText": (6.0, 20.0),
    "fontSizeFigureCaption": (5.0, 20.0),
    "fontSizeTableCaption": (5.0, 20.0),
}


class ExtractionResult(BaseModel):
    formatting: dict
    requirements: dict
    unresolved: list[str]  # fields the model could not find in the text


# --- Prompt construction ----------------------------------------------------
# A fill-in-the-blank skeleton plus one worked example gets a big accuracy
# jump on any instruct model, small or large - the model's job becomes
# copy-and-substitute rather than recall-and-format from a bare field list.

FIELD_PLACEHOLDERS: dict[str, str] = {
    "columnLayout": "single OR double OR NOT_SPECIFIED",
    "marginLeft": "number in mm, e.g. 25.4, OR NOT_SPECIFIED",
    "marginRight": "number in mm, e.g. 25.4, OR NOT_SPECIFIED",
    "marginTop": "number in mm, e.g. 25.4, OR NOT_SPECIFIED",
    "marginBottom": "number in mm, e.g. 25.4, OR NOT_SPECIFIED",
    "lineSpacing": "single OR double OR NOT_SPECIFIED",
    "fontSizeTitle": "number only, e.g. 14, OR NOT_SPECIFIED",
    "fontSizeText": "number only, e.g. 10, OR NOT_SPECIFIED",
    "fontSizeFigureCaption": "number only, e.g. 9, OR NOT_SPECIFIED",
    "fontSizeTableCaption": "number only, e.g. 9, OR NOT_SPECIFIED",
    "fontFamily": "Times New Roman OR Arial OR Computer Modern OR NOT_SPECIFIED",
    "keywordSeparator": "comma OR semicolon OR NOT_SPECIFIED",
    "documentClass": "IEEEtran.cls OR article.cls OR acmart.cls OR elsarticle.cls OR WileyNJDv5.cls OR sn-jnl.cls OR NOT_SPECIFIED",
    "referencingStyle": "APA OR Harvard OR IEEE OR Vancouver OR Numbered OR AuthorYear OR VancouverNumbered OR VancouverAuthorYear OR Chicago OR Basic OR MathPhysNumbered OR MathPhysAuthorYear OR APS OR Nature OR NOT_SPECIFIED",
    "orcidRequired": "yes OR no OR NOT_SPECIFIED",
}

EXTRACTION_SYSTEM_PROMPT = (
    "You are a precise data extraction tool, not a chat assistant. You read "
    "academic author guideline text and output plain 'fieldName: value' "
    "lines. You never write greetings, explanations, "
    "reasoning, markdown, bullet points, or code fences. Your entire reply "
    "is field lines and nothing else."
)

# A complete worked example - the single most effective thing for getting
# the line format and the "answer every field, even the missing ones"
# behaviour right in one shot.
FEW_SHOT_INPUT = (
    "Manuscripts must be typeset in two columns using 10 pt Times New Roman. "
    "Page margins should be 1 inch on all sides. Titles are set in 14 pt. "
    "Keywords are to be separated by semicolons. References follow APA style."
)

FEW_SHOT_OUTPUT = "\n".join([
    "columnLayout: double",
    "marginLeft: 25.4",
    "marginRight: 25.4",
    "marginTop: 25.4",
    "marginBottom: 25.4",
    "lineSpacing: NOT_SPECIFIED",
    "fontSizeTitle: 14",
    "fontSizeText: 10",
    "fontSizeFigureCaption: NOT_SPECIFIED",
    "fontSizeTableCaption: NOT_SPECIFIED",
    "fontFamily: Times New Roman",
    "keywordSeparator: semicolon",
    "documentClass: NOT_SPECIFIED",
    "referencingStyle: APA",
    "orcidRequired: NOT_SPECIFIED",
])


def _answer_skeleton() -> str:
    return "\n".join(
        f"{f}: <{FIELD_PLACEHOLDERS.get(f, 'value OR NOT_SPECIFIED')}>"
        for f in ALL_FIELDS
    )


def build_extraction_prompt(guideline_text: str) -> str:
    return (
        "Extract formatting rules from the author guideline text below.\n\n"
        "OUTPUT FORMAT - reply with exactly these "
        f"{len(ALL_FIELDS)} lines, in this order, with these exact field "
        "names. Replace each <...> with your answer and delete the angle "
        "brackets. Do not add, remove, rename or reorder any line. Do not "
        "write anything before the first line or after the last line.\n\n"
        f"{_answer_skeleton()}\n\n"
        "RULES:\n"
        "- Every one of the field names above must appear exactly once, even "
        "if the answer is NOT_SPECIFIED. Never omit a line.\n"
        "- Write NOT_SPECIFIED when the value is not stated in the "
        "guideline text below. Do not guess or invent values, and do not "
        "assume a publisher's usual convention if the text itself is "
        "silent on it.\n"
        "- Use only the exact options listed for each field. Do not invent "
        "new options and do not write a value that is not in the list.\n"
        "- Margins must be plain millimetre numbers with no unit. Convert "
        "inches yourself (1 inch = 25.4 mm) and centimetres yourself "
        "(1 cm = 10 mm). Write '25.4', never '1 inch' or '25.4mm'.\n"
        "- Font sizes must be plain numbers with no unit. Write '10', "
        "never '10pt'.\n"
        "- fontFamily: pick the closest of the three listed options if the "
        "text names a similar font (e.g. 'Nimbus Roman' -> Times New Roman).\n"
        "- No markdown, no bullets, no asterisks, no code fences, no "
        "explanation, no notes in brackets. Only the field lines.\n\n"
        "EXAMPLE\n"
        f"Guideline text:\n{FEW_SHOT_INPUT}\n\n"
        f"Correct reply:\n{FEW_SHOT_OUTPUT}\n\n"
        "END OF EXAMPLE\n\n"
        "GUIDELINE TEXT:\n"
        "-----BEGIN GUIDELINES-----\n"
        f"{guideline_text}\n"
        "-----END GUIDELINES-----\n\n"
        f"Now output the {len(ALL_FIELDS)} field lines for the guideline "
        "text above. Start your reply directly with 'columnLayout:'."
    )


RETRY_INSTRUCTION = (
    "That reply could not be parsed. Reply again with ONLY these "
    f"{len(ALL_FIELDS)} lines, one per line, nothing else - no markdown, no "
    "bullets, no asterisks, no code fences, no commentary, no blank-line "
    "headings. Keep the field names spelled exactly as shown and do not "
    "include the angle brackets in your answer:\n\n"
    f"{_answer_skeleton()}\n\n"
    "Start your reply directly with 'columnLayout:'."
)


# --- Response parsing -------------------------------------------------------
# All of this exists because instruct models - small or large - routinely
# wrap answers in markdown, rename keys, or restate a field twice. None of
# that should cost you a correctly-extracted value.

def _norm_key(text: str) -> str:
    """Lowercases and strips everything that isn't a letter or digit, so
    'Margin Left', 'margin_left', '**marginLeft**' all collapse to the same
    lookup key."""
    return re.sub(r"[^a-z0-9]", "", text.lower())


_FIELD_LOOKUP: dict[str, str] = {_norm_key(f): f for f in ALL_FIELDS + REQUIREMENT_FLAGS}

# Names models reach for instead of ours. Mapped explicitly because fuzzy
# matching is unreliable when the words are merely reordered
# ('figureCaptionFontSize' vs 'fontSizeFigureCaption').
KEY_ALIASES: dict[str, str] = {
    "columns": "columnLayout",
    "column": "columnLayout",
    "layout": "columnLayout",
    "numberofcolumns": "columnLayout",
    "columncount": "columnLayout",
    "leftmargin": "marginLeft",
    "rightmargin": "marginRight",
    "topmargin": "marginTop",
    "bottommargin": "marginBottom",
    "linespace": "lineSpacing",
    "linespacings": "lineSpacing",
    "spacing": "lineSpacing",
    "titlefontsize": "fontSizeTitle",
    "titlesize": "fontSizeTitle",
    "bodyfontsize": "fontSizeText",
    "textfontsize": "fontSizeText",
    "bodytextsize": "fontSizeText",
    "fontsize": "fontSizeText",
    "figurecaptionfontsize": "fontSizeFigureCaption",
    "figurecaptionsize": "fontSizeFigureCaption",
    "captionfontsizefigure": "fontSizeFigureCaption",
    "tablecaptionfontsize": "fontSizeTableCaption",
    "tablecaptionsize": "fontSizeTableCaption",
    "captionfontsizetable": "fontSizeTableCaption",
    "font": "fontFamily",
    "typeface": "fontFamily",
    "fontname": "fontFamily",
    "keywordsseparator": "keywordSeparator",
    "keywordsdelimiter": "keywordSeparator",
    "keywordseparators": "keywordSeparator",
    "class": "documentClass",
    "documentclassfile": "documentClass",
    "latexclass": "documentClass",
    "clsfile": "documentClass",
    "citationstyle": "referencingStyle",
    "referencestyle": "referencingStyle",
    "referencesstyle": "referencingStyle",
    "bibliographystyle": "referencingStyle",
    "orcid": "orcidRequired",
    "orcidid": "orcidRequired",
    "requiresorcid": "orcidRequired",
}

# A single 'margins: 25.4' line should populate all four margin fields.
_ALL_MARGINS = {"margin", "margins", "allmargins", "pagemargins", "pagemargin"}

_UNSPECIFIED_TOKENS = {
    "", "-", "--", "n/a", "na", "none", "null", "nil", "unknown", "unspecified",
    "notspecified", "notmentioned", "notstated", "notgiven", "notfound",
    "notapplicable", "tbd", "?", "value", "empty", "blank",
}


def _canonical_key(raw_key: str) -> str | None:
    """Maps whatever the model wrote on the left of the colon onto one of
    our field names, or None if it isn't one of our fields."""
    cleaned = re.sub(r"^[\s>*_#`\-•·\d.)\]\[\"']+", "", raw_key)
    cleaned = cleaned.replace("*", "").replace("`", "").replace('"', "").replace("'", "")
    norm = _norm_key(cleaned)
    if not norm:
        return None
    if norm in _ALL_MARGINS:
        return "__ALL_MARGINS__"
    if norm in _FIELD_LOOKUP:
        return _FIELD_LOOKUP[norm]
    if norm in KEY_ALIASES:
        return KEY_ALIASES[norm]
    match = difflib.get_close_matches(norm, list(_FIELD_LOOKUP), n=1, cutoff=0.85)
    if match:
        return _FIELD_LOOKUP[match[0]]
    return None


def _clean_value(raw_value: str) -> str:
    """Strips the decoration models wrap around values, and collapses every
    flavour of 'I don't know' onto the single NOT_SPECIFIED token."""
    value = raw_value.strip()
    value = re.sub(r"^```[a-zA-Z]*", "", value)
    value = value.replace("```", "")
    value = value.strip().strip("*`_ \t\"'“”")

    # 'single  # as stated in section 3' / 'double // two columns'
    value = re.split(r"\s+(?:#|//|--\s|—)", value)[0].strip()
    # 'Times New Roman (or similar serif)' -> 'Times New Roman'
    value = re.sub(r"\s*\([^()]*\)\s*$", "", value).strip()
    value = value.rstrip(".,;:").strip()

    # The model echoed the skeleton placeholder instead of answering.
    if "<" in value and ">" in value:
        return "NOT_SPECIFIED"

    if _norm_key(value) in _UNSPECIFIED_TOKENS:
        return "NOT_SPECIFIED"
    if _norm_key(value).startswith("notspecified"):
        return "NOT_SPECIFIED"

    return value


def _harvest_json(raw_text: str) -> dict[str, str]:
    """Some models answer with JSON no matter what the prompt says. Rather
    than fail the whole extraction, read the JSON if it's there."""
    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        return {}
    try:
        data = json.loads(match.group())
    except (json.JSONDecodeError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}

    flat: dict[str, str] = {}

    def walk(obj: dict) -> None:
        for key, value in obj.items():
            if isinstance(value, dict):
                walk(value)
            elif value is not None and not isinstance(value, (list, dict)):
                flat[str(key)] = str(value)

    walk(data)
    return flat


def _harvest_lines(raw_text: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for line in raw_text.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        raw_key, _, raw_value = line.partition(":")
        # Guard against a stray sentence containing a colon being read as a
        # field - keys are short, values live after the FIRST colon only.
        if len(raw_key) > 40:
            continue
        field = _canonical_key(raw_key)
        if field is None:
            continue
        value = _clean_value(raw_value)
        if field == "__ALL_MARGINS__":
            for margin_field in MARGIN_FIELDS:
                found.setdefault(margin_field, value)
            continue
        # First mention wins - models sometimes restate a field in a trailing
        # summary with a vaguer answer.
        found.setdefault(field, value)
    return found


def _normalize_constrained_value(field: str, raw_value: str) -> str | None:
    allowed = ALLOWED_VALUES.get(field)
    if allowed is None:
        return raw_value

    raw_lower = raw_value.strip().lower()
    for option in allowed:
        if option.lower() == raw_lower:
            return option

    aliases = {
        "double column": "double",
        "double-column": "double",
        "two column": "double",
        "two-column": "double",
        "twocolumn": "double",
        "2": "double",
        "2 columns": "double",
        "single column": "single",
        "single-column": "single",
        "one column": "single",
        "one-column": "single",
        "onecolumn": "single",
        "1": "single",
        "1 column": "single",
        "single spaced": "single",
        "single-spaced": "single",
        "double spaced": "double",
        "double-spaced": "double",
        "true": "yes",
        "false": "no",
        "required": "yes",
        "mandatory": "yes",
        "not required": "no",
        "optional": "no",
        ",": "comma",
        ";": "semicolon",
        "commas": "comma",
        "semicolons": "semicolon",
        "semi-colon": "semicolon",
        "times": "Times New Roman",
        "times roman": "Times New Roman",
        "timesnewroman": "Times New Roman",
        "helvetica": "Arial",
        "cmr": "Computer Modern",
        "latin modern": "Computer Modern",
        "ieeetran": "IEEEtran.cls",
        "acmart": "acmart.cls",
        "elsarticle": "elsarticle.cls",
        "article": "article.cls",
        "wileynjdv5": "WileyNJDv5.cls",
        "sn-jnl": "sn-jnl.cls",
        "snjnl": "sn-jnl.cls",
    }
    if raw_lower in aliases and aliases[raw_lower] in allowed:
        return aliases[raw_lower]

    # A bare class name without the .cls suffix, or with braces around it.
    if field == "documentClass":
        bare = raw_lower.strip("{}")
        if bare.endswith(".cls"):
            bare = bare[: -len(".cls")]
        for option in allowed:
            opt_bare = option.lower()
            if opt_bare.endswith(".cls"):
                opt_bare = opt_bare[: -len(".cls")]
            if opt_bare == bare:
                return option

    # Fuzzy fallback instead of giving up.
    close = difflib.get_close_matches(
        raw_lower, [o.lower() for o in allowed], n=1, cutoff=0.7
    )
    if close:
        for option in allowed:
            if option.lower() == close[0]:
                return option
    return None


def _in_range(field: str, number: float) -> bool:
    low, high = NUMERIC_RANGES.get(field, (float("-inf"), float("inf")))
    return low <= number <= high


def _normalize_numeric_value(field: str, raw_value: str) -> str | None:
    """Strips units like 'pt' and validates it's actually a plausible number."""
    match = re.search(r"\d+(?:\.\d+)?", raw_value)
    if not match:
        return None
    number = float(match.group())
    if not _in_range(field, number):
        return None
    return str(int(number)) if number == int(number) else str(number)


def _normalize_margin_value(field: str, raw_value: str) -> str | None:
    """
    Extracts the number and converts to millimeters if the value was
    given in inches or centimetres. The prompt already asks the model to do
    this conversion itself, but this is a code-level safety net in case the
    model returns something like '1in' or '2.5 cm' unconverted.
    """
    match = re.search(r"\d+(?:\.\d+)?", raw_value)
    if not match:
        return None
    number = float(match.group())

    # Check whatever immediately follows the number, rather than
    # searching the whole string - avoids missing cases like '1in' with
    # no space, and avoids false positives from unrelated text.
    remainder = raw_value[match.end():].strip().lower()
    if remainder.startswith(("in", '"', "″")):
        number = round(number * INCH_TO_MM, 1)
    elif remainder.startswith("cm"):
        number = round(number * CM_TO_MM, 1)

    if not _in_range(field, number):
        return None

    # Return as a clean integer string when possible (e.g. "25" not "25.0"),
    # otherwise keep one decimal place.
    return str(int(number)) if number == int(number) else str(number)


def parse_extraction_response(raw_text: str, min_fields: int = 3) -> ExtractionResult:
    raw_text = raw_text or ""

    found = _harvest_lines(raw_text)
    if len(found) < min_fields:
        # Line parsing came up short - the model may have answered in JSON.
        for key, value in _harvest_json(raw_text).items():
            field = _canonical_key(key)
            if field == "__ALL_MARGINS__":
                for margin_field in MARGIN_FIELDS:
                    found.setdefault(margin_field, _clean_value(value))
            elif field:
                found.setdefault(field, _clean_value(value))

    # A field is only "answered" if the model gave it a real value; a reply
    # that is fifteen NOT_SPECIFIED lines means the model didn't do the work.
    answered = [k for k, v in found.items() if v != "NOT_SPECIFIED"]

    # If almost nothing matched, the model likely ignored the task
    # entirely (e.g. due to a bad reply format) rather than genuinely
    # finding nothing - raise instead of silently returning all-blank.
    if len(found) < min_fields:
        raise ValueError(
            f"Model response contained only {len(found)} recognizable field "
            f"line(s) - likely a prompt-following failure, not a genuine "
            f"'nothing found' result."
        )
    if not answered:
        raise ValueError(
            "Model answered NOT_SPECIFIED for every field - treating as a "
            "prompt-following failure rather than a genuine empty result."
        )

    formatting: dict[str, str] = {}
    requirements: dict[str, bool | None] = {}
    unresolved: list[str] = []

    for field in FORMATTING_FIELDS:
        raw_value = found.get(field, "NOT_SPECIFIED")

        if raw_value == "NOT_SPECIFIED":
            cleaned = None
        elif field in MARGIN_FIELDS:
            cleaned = _normalize_margin_value(field, raw_value)
        elif field in FONT_SIZE_FIELDS:
            cleaned = _normalize_numeric_value(field, raw_value)
        elif field in ALLOWED_VALUES:
            cleaned = _normalize_constrained_value(field, raw_value)
        else:
            cleaned = raw_value  # unconstrained free-text field

        if cleaned is None:
            # Either not found, or the model returned something that doesn't
            # match what this field expects - flag it as unresolved rather
            # than pass through a value that will silently fail to render or
            # select. The default (when enabled) gives the user a sensible
            # starting point; Page2 still shows the "please verify" note
            # because the field stays in `unresolved`.
            unresolved.append(field)
            formatting[field] = ALL_DEFAULTS.get(field, "") if FILL_DEFAULTS else ""
        else:
            formatting[field] = cleaned

    for field in REQUIREMENT_FLAGS:
        value = found.get(field, "NOT_SPECIFIED")
        if value == "NOT_SPECIFIED":
            unresolved.append(field)
            requirements[field] = None  # unknown - let user decide
        else:
            requirements[field] = value.lower() in ("yes", "true", "required")

    return ExtractionResult(
        formatting=formatting, requirements=requirements, unresolved=unresolved
    )


# --- Model call -------------------------------------------------------------

def _local_extra_body() -> dict:
    if PROVIDER != "local":
        return {}
    return {
        "options": {
            "num_ctx": LOCAL_NUM_CTX,
            "temperature": 0,
            "top_p": 1,
            "repeat_penalty": 1.0,
        }
    }


def _call_model(messages: list[dict]) -> str:
    client = get_client()
    response = client.chat.completions.create(
        model=extraction_model(),
        messages=messages,
        temperature=0,
        max_tokens=800,   # 15 short lines; anything longer is the model rambling
        extra_body=_local_extra_body(),
    )
    return response.choices[0].message.content or ""


def call_groq_extraction(guideline_text: str) -> str:
    """Kept for backwards compatibility - single call, no retry."""
    return _call_model([
        {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": build_extraction_prompt(guideline_text)},
    ])


def extract_fields(guideline_text: str) -> ExtractionResult:
    """
    Calls the model and parses its reply, re-asking with a corrective
    message when the reply can't be parsed. Models frequently fail the
    format on the first attempt and get it right on the second once they
    are shown their own output and told what was wrong.

    Extraction runs on the author guideline text only - the publisher's
    LaTeX template is not forwarded here, so nothing in this prompt or its
    output depends on a template being present or well-formed.
    """
    messages = [
        {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": build_extraction_prompt(guideline_text)},
    ]

    last_error: Exception | None = None
    for attempt in range(1, MAX_EXTRACTION_ATTEMPTS + 1):
        raw = _call_model(messages)
        print(f"=== RAW MODEL OUTPUT (attempt {attempt}/{MAX_EXTRACTION_ATTEMPTS}) ===")
        print(raw)
        print("=== END ===")
        try:
            return parse_extraction_response(raw)
        except ValueError as exc:
            last_error = exc
            print(f"[extraction] attempt {attempt} unusable: {exc}")
            messages = messages[:2] + [
                {"role": "assistant", "content": raw[:2000]},
                {"role": "user", "content": RETRY_INSTRUCTION},
            ]

    raise ValueError(
        f"Model failed to produce parseable field lines after "
        f"{MAX_EXTRACTION_ATTEMPTS} attempts. Last error: {last_error}"
    )


# --- FastAPI route ----------------------------------------------------------

router = APIRouter()


class ExtractRequest(BaseModel):
    publisher: str
    guidelines: str = ""


@router.post("/api/extract-formatting-rules", response_model=ExtractionResult)
def extract_formatting_rules(payload: ExtractRequest):
    if not payload.guidelines.strip():
        raise HTTPException(
            status_code=400,
            detail="No guideline text was provided.",
        )

    try:
        return extract_fields(payload.guidelines)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Extraction failed: {exc}")
