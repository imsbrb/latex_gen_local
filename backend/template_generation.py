
import os
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from llm_client import get_client, generation_model

load_dotenv()
#GROQ_API_KEY = os.getenv("GROQ_API_KEY")

TEMPLATES_DIR = Path(__file__).parent / "templates"

TEMPLATE_FILENAMES = {
    "IEEE": "IEEE_l.tex",
    "ACM": "ACM_l.tex",
    "Elsevier": "Elsevier_l.tex",
    "Springer": "Springer_l.tex",
    "Wiley": "Wiley_l.tex",
}

GENERATION_SYSTEM_PROMPT = (
    "You are an expert LaTeX developer. You will be given the official "
    "LaTeX template for an academic publisher, along with a set of "
    "formatting rules and manuscript content collected from the author. "
    "Modify the template while following the rules commented within strictly "
    "so it reflects the given formatting rules and "
    "content. Keep the template's document class, required packages, and "
    "any publisher-mandated commands intact wherever they are not "
    "explicitly overridden by the provided fields. Replace placeholder "
    "content (title, author names, abstract text, sections, etc.) with "
    "the manuscript content provided. Only output the final, complete "
    "LaTeX code - no explanation, no markdown code fences, no commentary."
)


class GenerateTemplateRequest(BaseModel):
    publisher: str
    fields: dict[str, Any]  # all Page 2 + Page 3 field values from the frontend


class GenerateTemplateResponse(BaseModel):
    latex: str


def load_publisher_template(publisher: str,col:str) -> str:
    filename = TEMPLATE_FILENAMES.get(publisher)
    if not filename:
        raise ValueError(f"No template configured for publisher '{publisher}'.")
    

    path = TEMPLATES_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Template file '{filename}' not found in {TEMPLATES_DIR}. "
            f"Copy the publisher's official .tex template into the "
            f"backend's templates/ folder."
        )

    return path.read_text(encoding="utf-8", errors="ignore")

def _format_fields_for_prompt(fields: dict[str, Any]) -> str:
    """
    Turns the fields dict into a readable list for the prompt, skipping
    empty values so the model isn't distracted by blank fields the user
    left unfilled.
    """
    lines = []
    for key, value in fields.items():
        if value in (None, "", [], {}):
            continue
        # Author list and similar nested structures - keep readable
        if isinstance(value, list) and value and isinstance(value[0], dict):
            lines.append(f"- {key}:")
            for i, item in enumerate(value, start=1):
                item_str = ", ".join(f"{k}={v}" for k, v in item.items() if v not in (None, ""))
                lines.append(f"    {i}. {item_str}")
        else:
            lines.append(f"- {key}: {value}")
    return "\n".join(lines)


def build_generation_prompt(publisher: str, fields: dict[str, Any], template_text: str) -> str:
    fields_block = _format_fields_for_prompt(fields)
    return (
        f"Publisher: {publisher}\n\n"
        "Formatting rules and manuscript content to apply:\n"
        f"{fields_block}\n\n"
        f"Official {publisher} LaTeX template:\n"
        "-----BEGIN TEMPLATE-----\n"
        f"{template_text}\n"
        "-----END TEMPLATE-----\n\n"
        "Produce the final LaTeX document incorporating the fields above "
        "into this template."
    )


def call_groq_generation(prompt: str) -> str:
    client = get_client()
    response = client.chat.completions.create(
        model=generation_model(),
        messages=[
            {"role": "system", "content": GENERATION_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,  # low but not zero - some natural-language content (abstract etc) still needs to flow
    )
    return response.choices[0].message.content

def _strip_code_fences(text: str) -> str:
    """
    Defensive cleanup in case the model wraps its output in ```latex ... ```
    despite being told not to - doesn't rely on this, just guards against it.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("\n", 1)
        cleaned = parts[1] if len(parts) > 1 else cleaned
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3]
        cleaned = cleaned.strip()
    return cleaned


def generate_template(publisher: str, fields: dict[str, Any]) -> str:
    template_text = load_publisher_template(publisher,fields["columnLayout"])
    prompt = build_generation_prompt(publisher, fields, template_text)
    raw = call_groq_generation(prompt)
    return _strip_code_fences(raw)


# --- FastAPI route ----------------------------------------------------------

router = APIRouter()


@router.post("/api/generate-template", response_model=GenerateTemplateResponse)
def generate_template_route(payload: GenerateTemplateRequest):
    if not payload.publisher:
        raise HTTPException(status_code=400, detail="Publisher is required.")

    try:
        latex_code = generate_template(payload.publisher, payload.fields)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Generation failed: {exc}")

    return GenerateTemplateResponse(latex=latex_code)


if __name__ == "__main__":
    sample_fields = {
        "columnLayout": "double",
        "documentClass": "IEEEtran.cls",
        "title": "A Study of Example Systems",
        "abstract": "This is a sample abstract for testing the generation endpoint.",
        "keywords": ["machine learning", "example"],
        "authors": [
            {"firstName": "Jane", "lastName": "Doe", "email": "jane@example.edu", "corresponding": True}
        ],
    }
    result = generate_template("IEEE", sample_fields)
    print(result)