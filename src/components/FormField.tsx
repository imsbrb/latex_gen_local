import type { ReactNode } from "react";
import type React from "react";

export function Checkbox({
  label,
  checked = true,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      {/* Visual checkbox - no onClick needed */}
      <span
        className={`w-[15px] h-[15px] rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
          checked
            ? "bg-[#0f766e] border-[#0f766e]"
            : "bg-white border-[#cbd5e1]"
        }`}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 11 11" fill="none">
            <path
              d="M1.5 5.5l3 3 5-6"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      {/* Hidden real checkbox */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />

      <span className="text-[13px] text-[#0f172a]">{label}</span>
    </label>
  );
}

type LabelProps = {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  error?: string;
};

export function Field({
  label,
  required,
  hint,
  children,
  error,
}: LabelProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-[#0f172a] flex items-center gap-1">
        {label}
        {required && <span className="text-[#dc2626]">*</span>}
      </label>
      {hint && (
        <p className="text-[12px] text-[#94a3b8] -mt-1">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="text-[11px] text-[#dc2626]">{error}</p>
      )}
    </div>
  );
}

type InputProps =
  React.InputHTMLAttributes<HTMLInputElement> & {
    error?: boolean;
  };

export function Input({
  error,
  className = "",
  ...props
}: InputProps) {
  return (
    <input
      {...props}
      className={`h-10 px-3 text-[14px] bg-white border rounded-lg text-[#0f172a] placeholder-[#94a3b8] outline-none transition-colors focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 ${
        error ? "border-[#dc2626]" : "border-[#cbd5e1]"
      } ${className}`}
    />
  );
}

type MiniInputProps =
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
  };

export function MiniInput({ label, className = "", ...props }: MiniInputProps) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-2.5 px-1 bg-white text-[11px] font-medium text-[#64748b]">
        {label}
      </label>
      <input
        {...props}
        className={`h-10 w-full px-3 text-[14px] bg-white border border-[#cbd5e1] rounded-lg text-[#0f172a] outline-none transition-colors focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 ${className}`}
      />
    </div>
  );
}

type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    error?: boolean;
  };

export function Textarea({
  error,
  className = "",
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`px-3 py-2 text-[14px] bg-white border rounded-lg text-[#0f172a] placeholder-[#94a3b8] outline-none transition-colors focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 resize-none ${
        error ? "border-[#dc2626]" : "border-[#cbd5e1]"
      } ${className}`}
    />
  );
}

type SelectProps =
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    error?: boolean;
  };

export function Select({
  error,
  className = "",
  children,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`h-10 w-full pl-3 pr-9 text-[14px] bg-white border rounded-lg text-[#0f172a] outline-none transition-colors appearance-none cursor-pointer focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 ${
          error ? "border-[#dc2626]" : "border-[#cbd5e1]"
        } ${className}`}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b]"
        width="12"
        height="8"
        viewBox="0 0 12 8"
        fill="none"
      >
        <path
          d="M1 1l5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

type RadioGroupProps = {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
};

export function RadioGroup({
  name,
  options,
  value,
  onChange,
}: RadioGroupProps) {
  return (
    <div className="flex gap-6 flex-wrap">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
              value === opt.value
                ? "border-[#0f766e] bg-[#0f766e]"
                : "border-[#cbd5e1] bg-white group-hover:border-[#0f766e]"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {value === opt.value && (
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </div>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="sr-only"
          />
          <span className="text-[14px] text-[#0f172a]">
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  );
}

type SectionProps = {
  title: string;
  children: ReactNode;
};

export function Section({ title, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[13px] font-semibold text-[#334155] mb-2">
          {title}
        </h2>
        <div className="h-px bg-[#e2e8f0]" />
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

export function NavButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  if (variant === "ghost") {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-2 text-[14px] font-semibold text-[#0f766e] hover:text-[#0d5f58] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 h-11 px-6 text-[14px] font-semibold rounded-lg bg-[#0f766e] text-white hover:bg-[#0d5f58] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}