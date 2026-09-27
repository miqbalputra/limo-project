"use client";

import { useRef, useState } from "react";
import { generateStrongPassword } from "@/lib/password-generator";

type PasswordFieldProps = {
  name: string;
  label: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
};

export function PasswordField({ name, label, required = false, autoComplete = "new-password", hint }: PasswordFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);

  function fillRandomPassword() {
    if (inputRef.current) {
      inputRef.current.value = generateStrongPassword();
    }
    setVisible(true);
  }

  return (
    <div className="grid gap-1">
      <label className="text-theme-xs font-medium text-gray-600" htmlFor={`password-field-${name}`}>
        {label}{required ? null : <span className="font-normal text-gray-400"> (opsional)</span>}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={`password-field-${name}`}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={8}
          maxLength={128}
          autoComplete={autoComplete}
          className="tailadmin-input min-h-11 min-w-0 flex-1"
        />
        <button type="button" onClick={fillRandomPassword} className="tailadmin-button-outline min-h-11 px-3 py-2">Buat password acak</button>
        <button type="button" onClick={() => setVisible((current) => !current)} aria-pressed={visible} className="tailadmin-button-outline min-h-11 px-3 py-2">
          {visible ? "Sembunyikan" : "Lihat"}
        </button>
      </div>
      {hint ? <p className="text-theme-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
