import { useState } from "react";
import {
  FileText,
  HelpCircle,
  Settings as SettingsIcon,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import Page1 from "./pages/Page1";
import Page2 from "./pages/Page2";
import Page3 from "./pages/Page3";

export type FormData = {
  // Page 1
  publisher: string;
  authorGuidelines: string;
  // Page 2
  columnLayout: "single" | "double" | "";
  marginLeft: string;
  marginRight: string;
  marginTop: string;
  marginBottom: string;
  lineSpacing: "single" | "double" | "";
  fontSizeTitle: string;
  fontSizeText: string;
  fontSizeFigureCaption: string;
  fontSizeTableCaption: string;
  fontFamily: string;
  keywordSeparator: "comma" | "semicolon" | "";
  documentClass: string;
  referencingStyle: string;
  highlights: "yes" | "no" | "";
  orcidRequired: "yes" | "no" | "";
  // Page 3
  title: string;
  numAuthors: string;
  authors: Author[];
  keywords: string[];
  abstract: string;
  conclusion: string;
  keySections: string[];
  bibliography: File | null;
  bibliographyText: string;
  dataAvailability: string;
  fundingStatement: string;
  conflictOfInterest: string;
  ethicsApproval: string;
  consentForPublication: string;
  authorContributions: string;
  creditStatement: string;
  generativeAI: string;
};

export type Author = {
  firstName: string;
  lastName: string;
  email: string;
  affiliation: string;
  orcidId: string;
  corresponding: boolean;
};

const initialData: FormData = {
  publisher: "",
  authorGuidelines: "",
  columnLayout: "",
  marginLeft: "",
  marginRight: "",
  marginTop: "",
  marginBottom: "",
  lineSpacing: "",
  fontSizeTitle: "",
  fontSizeText: "",
  fontSizeFigureCaption: "",
  fontSizeTableCaption: "",
  fontFamily: "",
  keywordSeparator: "",
  documentClass: "",
  referencingStyle: "",
  highlights: "",
  orcidRequired: "",
  title: "",
  numAuthors: "",
  authors: [],
  keywords: [""],
  abstract: "",
  conclusion: "",
  keySections: [
  "Introduction",
  "Literature Review",
  "Methodology",
  "Experimentation",
  "Results",
  "Discussion",
],
  bibliography: null,
  bibliographyText: "",
  dataAvailability: "",
  fundingStatement: "",
  conflictOfInterest: "",
  ethicsApproval: "",
  consentForPublication: "",
  authorContributions: "",
  creditStatement: "",
  generativeAI: "",
};

const NAV_ITEMS = [
  { page: 1, label: "Publisher", icon: Building2 },
  { page: 2, label: "Settings", icon: SlidersHorizontal },
  { page: 3, label: "Manuscript", icon: FileText },
] as const;

const STEP_LABELS = ["Guidelines", "Technical Specs", "Manuscript"];

export default function App() {
  const [page, setPage] = useState(1);
  const [formData, setFormData] =
    useState<FormData>(initialData);

  // Tracks which Page 2 fields the AI extractor couldn't find in the
  // pasted guidelines, so Page2 can flag them for the user to verify.
  const [unresolvedFields, setUnresolvedFields] = useState<string[]>([]);

  // Tracks which Page 3 declarations/statements the guidelines actually
  // require (true/false/null-unknown), so Page3 can pre-check them.
  const [requirements, setRequirements] = useState<Record<string, boolean | null>>({});

  const updateForm = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSaveDraft = () => {
    // Placeholder for save-draft persistence logic
    console.log("Draft saved", formData);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-[#1e293b]">
      {/* Top bar */}
      <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-20">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#0f766e]" strokeWidth={2} />
            <span className="text-xl font-bold text-[#0f766e]">
              Author Guidelines Form
            </span>
          </div>
          <div className="flex items-center gap-5">
            <HelpCircle className="w-5 h-5 text-[#64748b] cursor-pointer hover:text-[#0f766e] transition-colors" />
            <SettingsIcon className="w-5 h-5 text-[#64748b] cursor-pointer hover:text-[#0f766e] transition-colors" />
            <div className="w-8 h-8 rounded-full bg-[#cbd5e1] overflow-hidden flex items-center justify-center text-xs font-semibold text-[#475569]">
              <span>U</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left sidebar */}
        <aside className="w-64 shrink-0 min-h-[calc(100vh-4rem)] bg-[#f8fafc] border-r border-[#e2e8f0] flex flex-col justify-between px-4 py-6">
          <div>
            <div className="px-2 mb-6">
              <h2 className="text-base font-bold text-[#0f172a] leading-tight">
                Formatting
                <br />
                Progress
              </h2>
              <p className="text-sm text-[#64748b] mt-1">
                Step {page} of 3
              </p>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ page: itemPage, label, icon: Icon }) => {
                const isActive = page === itemPage;
                return (
                  <button
                    key={itemPage}
                    onClick={() => setPage(itemPage)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#ccfbf1] text-[#0f766e]"
                        : "text-[#475569] hover:bg-[#f1f5f9]"
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </nav>
          </div>

          <button
            onClick={handleSaveDraft}
            className="w-full bg-[#0f766e] hover:bg-[#0d5f58] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            Save Draft
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-8 py-10">
          {/* Step progress indicator */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      page === n
                        ? "bg-[#0f766e] ring-4 ring-[#0f766e]/20"
                        : page > n
                          ? "bg-[#0f766e]"
                          : "bg-[#cbd5e1]"
                    }`}
                  />
                  {n < 3 && (
                    <div
                      className={`w-16 h-px ${
                        page > n ? "bg-[#0f766e]" : "bg-[#cbd5e1]"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <span className="text-xs tracking-[0.15em] uppercase font-semibold text-[#64748b] mt-2">
              Step {page} of 3: {STEP_LABELS[page - 1]}
            </span>
          </div>

          <div className="max-w-3xl mx-auto">
            {page === 1 && (
              <Page1
                data={formData}
                update={updateForm}
                onNext={() => setPage(2)}
                setUnresolvedFields={setUnresolvedFields}
                setRequirements={setRequirements}
              />
            )}
            {page === 2 && (
              <Page2
                data={formData}
                update={updateForm}
                onNext={() => setPage(3)}
                onBack={() => setPage(1)}
                unresolvedFields={unresolvedFields}
              />
            )}
            {page === 3 && (
              <Page3
                data={formData}
                update={updateForm}
                onBack={() => setPage(2)}
                requirements={requirements}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}