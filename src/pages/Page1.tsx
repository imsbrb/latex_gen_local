import { useState } from "react";
import type React from "react";
import type { FormData } from "../App";
import { Field, Select, Textarea, Section, NavButton } from "../components/FormField";

const API_BASE_URL = "http://localhost:8000";

interface Props {
  data: FormData;
  update: (updates: Partial<FormData>) => void;
  onNext: () => void;
  setUnresolvedFields?: (fields: string[]) => void;
  setRequirements?: (requirements: Record<string, boolean | null>) => void;
}

export default function Page1({
  data,
  update,
  onNext,
  setUnresolvedFields,
  setRequirements,
}: Props) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const requiredFilled = data.publisher !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requiredFilled) return;

    // If no guidelines were pasted, there's nothing to extract - just move on.
    if (!data.authorGuidelines.trim()) {
      onNext();
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/extract-formatting-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publisher: data.publisher,
          guidelines: data.authorGuidelines,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Request failed (${res.status})`);
      }

      const result = await res.json();

      // Pre-fill Page 2's fields with whatever the extractor found.
      update(result.formatting);

      // Let Page 2 know which fields it couldn't find, so it can show
      // the "please verify" note we added earlier.
      setUnresolvedFields?.(result.unresolved ?? []);

      // Let Page 3 know which declarations the guidelines actually
      // require, so it can pre-check them before the user gets there.
      setRequirements?.(result.requirements ?? {});

      onNext();
    } catch (err) {
      // Extraction failing shouldn't block the user entirely - let them
      // continue and fill everything in manually on Page 2 instead.
      setExtractError(
        err instanceof Error ? err.message : "Extraction failed - you can still fill in fields manually."
      );
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="text-3xl font-bold text-[#0f172a] mb-2 text-center">
        New submission
      </h1>
      <p className="text-center text-[#64748b] mb-6">
        Choose the target publisher to load its formatting rules.
      </p>

      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 flex flex-col gap-6">
        <Field label="Publisher" required>
          <Select
            value={data.publisher}
            onChange={(e) => update({ publisher: e.target.value })}
          >
            <option value="">Select a publisher…</option>
            <option value="IEEE">IEEE</option>
            <option value="Elsevier">Elsevier</option>
            <option value="Springer">Springer</option>
            <option value="ACM">ACM</option>
            <option value="Wiley">Wiley</option>
          </Select>
        </Field>

        <div className="h-px bg-[#e2e8f0]" />

        <Section title="Smart Guidelines">
          <Field
            label="Paste Author Guidelines"
            hint="Our AI will automatically fill the technical specs based on the text provided."
          >
            <Textarea
              className="min-h-[140px]"
              placeholder="Paste the text from the publisher's website here…"
              value={data.authorGuidelines}
              onChange={(e) => update({ authorGuidelines: e.target.value })}
            />
          </Field>
          {extractError && (
            <p className="text-sm text-[#b45309] mt-2">{extractError}</p>
          )}
        </Section>

        <div className="h-px bg-[#e2e8f0]" />

        <div className="flex items-center justify-end">
          <NavButton type="submit" disabled={!requiredFilled || isExtracting}>
            {isExtracting ? "Extracting formatting rules…" : "Continue"}
            {!isExtracting && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7h8M7 3l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </NavButton>
        </div>
      </div>

      <p className="text-center text-sm text-[#94a3b8] mt-4">
        Settings are automatically saved as you edit.
      </p>
    </form>
  );
}