import { useRef, useState } from "react";
import type { FormData, Author } from "../App";
import {
  Field,
  Input,
  Textarea,
  Checkbox,
  NavButton,
} from "../components/FormField";

const API_BASE_URL = "http://localhost:8000";

interface Props {
  data: FormData;
  update: (updates: Partial<FormData>) => void;
  onBack: () => void;
  requirements?: Record<string, boolean | null>;
}

const KEY_SECTIONS = [
  "Introduction",
  "Literature Review",
  "Methodology",
  "Experimentation",
  "Results",
  "Discussion",
];

const emptyAuthor: Author = {
  firstName: "",
  lastName: "",
  email: "",
  affiliation: "",
  orcidId: "",
  corresponding: false,
};

// One entry per declaration/statement field - drives the checkbox-gated
// list below so each starts hidden until the user opts in.
type DeclarationKey =
  | "dataAvailability"
  | "fundingStatement"
  | "conflictOfInterest"
  | "ethicsApproval"
  | "consentForPublication"
  | "authorContributions"
  | "generativeAI";

type AllDeclarationKeys = DeclarationKey | "creditStatement";

const DECLARATIONS: { key: DeclarationKey; label: string }[] = [
  { key: "dataAvailability", label: "Data Availability" },
  { key: "fundingStatement", label: "Funding" },
  { key: "conflictOfInterest", label: "Conflict of Interest" },
  { key: "ethicsApproval", label: "Ethics Approval" },
  { key: "consentForPublication", label: "Consent for Publication" },
  { key: "authorContributions", label: "Author Contributions" },
  { key: "generativeAI", label: "Generative AI Use" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Standard ORCID format: 0000-0002-1825-0097 (last character may be X)
const ORCID_REGEX = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

// Well-known HEC-recognized Pakistani universities. This is not guaranteed
// to be the complete official list (HEC's own list currently has 184
// entries, loaded dynamically on their site) - extend this array as needed.
// The "Other" option below covers anything not yet in this list.
const PAKISTANI_UNIVERSITIES = [
  "Quaid-i-Azam University, Islamabad",
  "University of the Punjab, Lahore",
  "University of Karachi, Karachi",
  "Lahore University of Management Sciences (LUMS), Lahore",
  "National University of Sciences and Technology (NUST), Islamabad",
  "COMSATS University Islamabad",
  "FAST National University of Computer and Emerging Sciences (FAST-NUCES)",
  "Ghulam Ishaq Khan Institute of Engineering Sciences and Technology (GIKI), Topi",
  "University of Engineering and Technology (UET), Lahore",
  "NED University of Engineering and Technology, Karachi",
  "University of Agriculture, Faisalabad",
  "Aga Khan University, Karachi",
  "Institute of Business Administration (IBA), Karachi",
  "Bahauddin Zakariya University, Multan",
  "University of Peshawar, Peshawar",
  "University of Sindh, Jamshoro",
  "Balochistan University of Information Technology, Engineering and Management Sciences, Quetta",
  "University of Balochistan, Quetta",
  "International Islamic University, Islamabad",
  "Pakistan Institute of Engineering and Applied Sciences (PIEAS), Islamabad",
  "University of Management and Technology (UMT), Lahore",
  "University of Central Punjab (UCP), Lahore",
  "Government College University (GCU), Lahore",
  "Government College University (GCU), Faisalabad",
  "Fatima Jinnah Women University, Rawalpindi",
  "Air University, Islamabad",
  "Bahria University, Islamabad",
  "Riphah International University, Islamabad",
  "Foundation University, Islamabad",
  "Iqra University, Karachi",
  "Sir Syed University of Engineering and Technology, Karachi",
  "Dawood University of Engineering and Technology, Karachi",
  "Mehran University of Engineering and Technology, Jamshoro",
  "Dow University of Health Sciences, Karachi",
  "King Edward Medical University, Lahore",
  "Allama Iqbal Open University, Islamabad",
  "Virtual University of Pakistan, Lahore",
  "Preston University, Islamabad",
  "Superior University, Lahore",
  "University of Gujrat, Gujrat",
  "University of Sargodha, Sargodha",
  "Islamia University of Bahawalpur, Bahawalpur",
  "Hazara University, Mansehra",
  "Abdul Wali Khan University, Mardan",
  "Sarhad University of Science and Information Technology, Peshawar",
  "University of Malakand, Chakdara",
  "Shaheed Zulfikar Ali Bhutto Institute of Science and Technology (SZABIST), Karachi",
  "Karakoram International University, Gilgit",
  "Mirpur University of Science and Technology (MUST), Mirpur",
  "University of Azad Jammu and Kashmir, Muzaffarabad",
  "Pir Mehr Ali Shah Arid Agriculture University, Rawalpindi",
];

// Small searchable dropdown for affiliation - filters the list above as
// the user types, always offers an "Other" fallback to type manually.
function AffiliationCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const isKnownUniversity = PAKISTANI_UNIVERSITIES.includes(value);
  const [mode, setMode] = useState<"search" | "manual">(
    value && !isKnownUniversity ? "manual" : "search"
  );
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  const matches = PAKISTANI_UNIVERSITIES.filter((u) =>
    u.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  if (mode === "manual") {
    return (
      <div className="flex flex-col gap-1">
        <Input
          placeholder="University, Department, City, Country"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="text-[12px] text-[#0f766e] text-left hover:underline w-fit"
          onClick={() => {
            setMode("search");
            setQuery("");
            onChange("");
          }}
        >
          Choose from list instead
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Search Pakistani universities…"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-[#e2e8f0] rounded-lg shadow-lg">
          {matches.map((uni) => (
            <button
              key={uni}
              type="button"
              onMouseDown={() => {
                onChange(uni);
                setQuery(uni);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-[13px] text-[#0f172a] hover:bg-[#f0fdfa]"
            >
              {uni}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={() => {
              setMode("manual");
              setQuery("");
              onChange("");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f0fdfa] border-t border-[#e2e8f0]"
          >
            Other (enter manually)
          </button>
        </div>
      )}
    </div>
  );
}

function wordCount(text: string) {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export default function Page3({ data, update, onBack, requirements = {} }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const abstractWords = wordCount(data.abstract);
  const abstractLimit = 250;
  const abstractOverLimit = abstractWords > abstractLimit;
  const titleWords = wordCount(data.title);
  const keywordCount = data.keywords.filter((k) => k.trim() !== "").length;

  // Which declaration fields the user has opted to include. Priority:
  // 1) if the guidelines explicitly said this is required, pre-check it
  //    automatically (before the user does anything)
  // 2) otherwise, fall back to whether the field already has content
  //    (e.g. manually filled in on a previous visit to this page)
  const [declarationEnabled, setDeclarationEnabled] = useState<
    Record<AllDeclarationKeys, boolean>
  >(() => {
    const keys: AllDeclarationKeys[] = [
      ...DECLARATIONS.map((d) => d.key),
      "creditStatement",
    ];
    return Object.fromEntries(
      keys.map((key) => {
        const requirementKey = `${key}Required`;
        const isRequired = requirements[requirementKey] === true;
        const hasContent = Boolean((data[key] as string)?.trim());
        return [key, isRequired || hasContent];
      })
    ) as Record<AllDeclarationKeys, boolean>;
  });

  const toggleDeclaration = (key: AllDeclarationKeys, checked: boolean) => {
    setDeclarationEnabled((prev) => ({ ...prev, [key]: checked }));
    // Clear the field's value when the user turns it off, so unchecked
    // declarations don't silently carry stale text through to submission.
    if (!checked) {
      update({ [key]: "" } as Partial<FormData>);
    }
  };

  const completionChecks = [
    data.title.trim() !== "",
    data.authors.length > 0 &&
      data.authors.every(
        (a) =>
          a.firstName &&
          a.lastName &&
          EMAIL_REGEX.test(a.email) &&
          (a.orcidId === "" || ORCID_REGEX.test(a.orcidId))
      ),
    data.abstract.trim() !== "" && !abstractOverLimit,
    data.conclusion.trim() !== "",
    keywordCount > 0,
    data.keySections.length > 0,
    Boolean(data.bibliography) || data.bibliographyText.trim() !== "",
    data.dataAvailability.trim() !== "",
    data.fundingStatement.trim() !== "",
    data.conflictOfInterest.trim() !== "",
    data.ethicsApproval.trim() !== "",
    data.consentForPublication.trim() !== "",
    data.authorContributions.trim() !== "",
    data.generativeAI.trim() !== "",
    data.publisher !== "Elsevier" || data.creditStatement.trim() !== "",
  ];
  const completionPercent = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100
  );

  const [keywordsText, setKeywordsText] = useState(
    data.keywords.filter(Boolean).join(", ")
  );

  const handleKeywordsChange = (value: string) => {
    setKeywordsText(value);
    const parsed = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    update({ keywords: parsed });
  };

  const handleNumAuthorsChange = (value: string) => {
    const n = Math.max(0, Math.min(20, parseInt(value, 10) || 0));
    const nextAuthors = Array.from(
      { length: n },
      (_, i) => data.authors[i] ?? { ...emptyAuthor }
    );
    update({ numAuthors: value, authors: nextAuthors });
  };

  const updateAuthor = (index: number, updates: Partial<Author>) => {
    const next = data.authors.map((a, i) =>
      i === index ? { ...a, ...updates } : a
    );
    update({ authors: next });
  };

  const toggleKeySection = (section: string, checked: boolean) => {
    const next = checked
      ? [...data.keySections, section]
      : data.keySections.filter((s) => s !== section);
    update({ keySections: next });
  };

  const handleDownloadLatex = async () => {
    if (!data.publisher) {
      alert("Please select a publisher on the previous page.");
      return;
    }

    setIsGenerating(true);

    try {
      // Standard name used for the generated .bib file
      const BIB_FILENAME = "references.bib";

      // If the user typed BibTeX into the textarea, create a .bib file,
      // set it on the form's bibliography field, and trigger a download.
      if (data.bibliographyText.trim()) {
        const bibBlob = new Blob([data.bibliographyText], {
          type: "application/x-bibtex",
        });
        const bibFile = new File([bibBlob], BIB_FILENAME, {
          type: "application/x-bibtex",
        });

        // Store the generated file in the form state
        update({ bibliography: bibFile });

        // Trigger download of the .bib file
        const bibUrl = URL.createObjectURL(bibBlob);
        const bibLink = document.createElement("a");
        bibLink.href = bibUrl;
        bibLink.download = BIB_FILENAME;
        document.body.appendChild(bibLink);
        bibLink.click();
        document.body.removeChild(bibLink);
        URL.revokeObjectURL(bibUrl);
      }

      const response = await fetch(`${API_BASE_URL}/api/generate-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publisher: data.publisher,
          fields: {
            ...data,
            // Ensure the backend sees the standard bibliography filename
            // when text was provided
            bibliography:
              data.bibliographyText.trim()
                ? { name: BIB_FILENAME }
                : data.bibliography,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const latex = result.latex;

      if (!latex) {
        throw new Error("No LaTeX content received from server.");
      }

      const blob = new Blob([latex], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "manuscript.tex";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("LaTeX generation failed:", error);
      alert(`Failed to generate LaTeX: ${error instanceof Error ? error.message : "Unknown error"}. Please check the console for details.`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <form>
    <div className="grid grid-cols-[1fr_260px] gap-6 items-start">
      {/* Main form column */}
      <div className="flex flex-col gap-6">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-[#0f172a] mb-6">
            Core Information
          </h1>
          <div className="h-px bg-[#e2e8f0] -mt-4 mb-6" />

          <div className="flex flex-col gap-6">
            <Field label="Manuscript Title">
              <Input
                placeholder="Enter the full title of your research paper"
                value={data.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </Field>

            <Field label="Number of Authors">
              <Input
                type="number"
                min={0}
                max={20}
                className="max-w-[160px]"
                placeholder="e.g. 3"
                value={data.numAuthors}
                onChange={(e) => handleNumAuthorsChange(e.target.value)}
              />
            </Field>

            {data.authors.length > 0 && (
              <div className="flex flex-col gap-5">
                {data.authors.map((author, i) => {
                  const emailTouched = author.email.trim() !== "";
                  const emailValid = EMAIL_REGEX.test(author.email);
                  const orcidTouched = author.orcidId.trim() !== "";
                  const orcidValid = ORCID_REGEX.test(author.orcidId);

                  return (
                    <div
                      key={i}
                      className="border border-[#e2e8f0] rounded-xl p-5 flex flex-col gap-4"
                    >
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-[#64748b]">
                        Author {i + 1}
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="First Name">
                          <Input
                            value={author.firstName}
                            onChange={(e) =>
                              updateAuthor(i, { firstName: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Last Name">
                          <Input
                            value={author.lastName}
                            onChange={(e) =>
                              updateAuthor(i, { lastName: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Email Address">
                          <Input
                            type="email"
                            value={author.email}
                            error={emailTouched && !emailValid}
                            onChange={(e) =>
                              updateAuthor(i, { email: e.target.value })
                            }
                          />
                          {emailTouched && !emailValid && (
                            <p className="text-[12px] text-[#dc2626] mt-1">
                              Enter a valid email address (e.g. name@university.edu)
                            </p>
                          )}
                        </Field>
                        {data.orcidRequired === "yes" && (
                        <Field label="ORCID ID">
                          <Input
                            placeholder="0000-0000-0000-0000"
                            value={author.orcidId}
                            error={orcidTouched && !orcidValid}
                            onChange={(e) =>
                              updateAuthor(i, { orcidId: e.target.value })
                            }
                          />
                          {orcidTouched && !orcidValid && (
                            <p className="text-[12px] text-[#dc2626] mt-1">
                              Format must be 0000-0000-0000-0000 (last character may be X)
                            </p>
                          )}
                        </Field>
                        )}
                      </div>
                      <Field label="Affiliation">
                        <AffiliationCombobox
                          value={author.affiliation}
                          onChange={(value) =>
                            updateAuthor(i, { affiliation: value })
                          }
                        />
                      </Field>
                      <Checkbox
                        label="Corresponding author"
                        checked={author.corresponding}
                        onChange={(checked) =>
                          updateAuthor(i, { corresponding: checked })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <Field
              label="Keywords"
              hint="Separate each keyword with a comma — e.g. Machine Learning, NLP, Deep Learning"
            >
              <Input
                placeholder="e.g. Machine Learning, NLP, Deep Learning"
                value={keywordsText}
                onChange={(e) => handleKeywordsChange(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-[#0f172a] mb-6">
            Narrative Elements
          </h1>
          <div className="h-px bg-[#e2e8f0] -mt-4 mb-6" />

          <div className="flex flex-col gap-6">
            <Field label="Abstract">
              <Textarea
                rows={5}
                placeholder="Provide a concise summary of your research…"
                value={data.abstract}
                error={abstractOverLimit}
                onChange={(e) => update({ abstract: e.target.value })}
              />
              <div className="flex justify-between text-[12px] mt-1">
                <span
                  className={
                    abstractOverLimit
                      ? "text-[#dc2626] font-semibold"
                      : "text-transparent select-none"
                  }
                >
                  Character limit exceeded
                </span>
                <span
                  className={
                    abstractOverLimit
                      ? "text-[#dc2626] font-semibold"
                      : "text-[#94a3b8]"
                  }
                >
                  {abstractWords} / {abstractLimit} words
                </span>
              </div>
            </Field>

            <Field label="Conclusion">
              <Textarea
                rows={4}
                placeholder="State the primary conclusions of the study…"
                value={data.conclusion}
                onChange={(e) => update({ conclusion: e.target.value })}
              />
            </Field>

            <Field label="Key Sections Included">
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 mt-1">
                {KEY_SECTIONS.map((section) => (
                  <Checkbox
                    key={section}
                    label={section}
                    checked={data.keySections.includes(section)}
                    onChange={(checked) => toggleKeySection(section, checked)}
                  />
                ))}
              </div>
            </Field>

            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-semibold text-[#0f172a]">
                Bibliography
              </label>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#cbd5e1] rounded-xl py-8 flex flex-col items-center gap-2 hover:border-[#0f766e] transition-colors"
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path
                    d="M14 4v14m0-14 5 5m-5-5-5 5M6 22h16"
                    stroke="#0f766e"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[14px] font-semibold text-[#0f766e]">
                  Upload Bibliography (.bib)
                </span>
                <span className="text-[12px] text-[#94a3b8]">
                  {data.bibliography
                    ? data.bibliography.name
                    : "BibTeX files only, max 5MB"}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".bib"
                className="hidden"
                onChange={(e) =>
                  update({ bibliography: e.target.files?.[0] ?? null })
                }
              />

              <div className="flex items-center gap-3 text-[12px] text-[#94a3b8]">
                <div className="flex-1 h-px bg-[#e2e8f0]" />
                or paste BibTeX directly
                <div className="flex-1 h-px bg-[#e2e8f0]" />
              </div>

              <Textarea
                rows={4}
                placeholder="@article{key, title={...}, author={...}, ...}"
                className="font-mono text-[13px]"
                value={data.bibliographyText}
                onChange={(e) => update({ bibliographyText: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-[#0f172a] mb-6">
            Declarations &amp; Statements
          </h1>
          <div className="h-px bg-[#e2e8f0] -mt-4 mb-6" />

          <div className="flex flex-col gap-5">
            {DECLARATIONS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-2">
                <Checkbox
                  label={`Include ${label} statement`}
                  checked={declarationEnabled[key]}
                  onChange={(checked) => toggleDeclaration(key, checked)}
                />
                {declarationEnabled[key] && (
                  <Field label={label}>
                    <Input
                      value={data[key]}
                      onChange={(e) =>
                        update({ [key]: e.target.value } as Partial<FormData>)
                      }
                    />
                  </Field>
                )}
              </div>
            ))}

            {data.publisher === "Elsevier" && (
              <div className="flex flex-col gap-2">
                <Checkbox
                  label="Include CRediT statement"
                  checked={declarationEnabled.creditStatement}
                  onChange={(checked) =>
                    toggleDeclaration("creditStatement", checked)
                  }
                />
                {declarationEnabled.creditStatement && (
                  <Field label="Credit Statement">
                    <Textarea
                      rows={3}
                      placeholder="Contributor Roles Taxonomy details…"
                      value={data.creditStatement}
                      onChange={(e) =>
                        update({ creditStatement: e.target.value })
                      }
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <NavButton variant="ghost" type="button" onClick={onBack}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M11 7H3M7 11L3 7l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to Settings
          </NavButton>
        </div>
      </div>

      {/* Right sidebar: live checks + actions */}
      <div className="flex flex-col gap-4 sticky top-24">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="9" width="3" height="6" rx="0.5" fill="#0f766e" />
              <rect x="6.5" y="5" width="3" height="10" rx="0.5" fill="#0f766e" />
              <rect x="12" y="1" width="3" height="14" rx="0.5" fill="#0f766e" />
            </svg>
            <h3 className="text-[14px] font-bold text-[#0f172a]">
              Live Checks
            </h3>
          </div>

          <div className="flex flex-col gap-3 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#64748b]">Title length</span>
              <span className="font-semibold text-[#0f172a]">
                {titleWords} words
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-[#e2e8f0]">
              <span className="text-[#64748b]">Abstract length</span>
              <span
                className={`font-semibold ${
                  abstractOverLimit ? "text-[#dc2626]" : "text-[#0f172a]"
                }`}
              >
                {abstractWords} / {abstractLimit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Page count</span>
              <span className="font-semibold text-[#0f172a]">Est. 1 pg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Keyword count</span>
              <span className="font-semibold text-[#0f172a]">
                {keywordCount} / 5
              </span>
            </div>
             {data.publisher === "Elsevier" && (
            <div className="flex justify-between">
              <span className="text-[#64748b]">Highlights length</span>
              <span className="font-semibold text-[#0f172a]">
                {data.highlights === ""
                  ? "Pending"
                  : data.highlights === "yes"
                  ? "Required"
                  : "Not required"}
              </span>
            </div>
             )}
          </div>

          <div className="mt-4 flex items-start gap-2 bg-[#f0fdfa] border border-[#99f6e4] rounded-lg p-3">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="mt-0.5 flex-shrink-0"
            >
              <circle cx="7" cy="7" r="6" stroke="#0f766e" strokeWidth="1.3" />
              <path
                d="M7 6v4M7 4.3v.1"
                stroke="#0f766e"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-[12px] text-[#0f766e] leading-snug">
              Your manuscript currently meets {completionPercent}% of the
              selected journal's baseline formatting requirements.
            </p>
          </div>
        </div>

        <button className="h-9 bg-[#0f766e] hover:bg-[#0d5f58] text-white text-[13px] font-semibold rounded-lg transition-colors">
          Submit Manuscript
        </button>
        <button
          type="button"
          onClick={handleDownloadLatex}
          disabled={isGenerating || !data.publisher}
          className="h-9 border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            "Generating LaTeX..."
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1v8m0 0 3-3m-3 3-3-3M2 12h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Download File(s)
            </>
          )}
        </button>
      </div>
    </div>
    </form>
  );
}