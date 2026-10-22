"use client";

import { useState } from "react";
import { input } from "@/lib/ui";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  describedBy?: string;
  disabled?: boolean;
};

// Kolom password dengan tombol lihat/sembunyikan, agar salah ketik mudah dikoreksi.
export function PasswordField({ id, value, onChange, autoComplete, placeholder, describedBy, disabled }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-describedby={describedBy}
        disabled={disabled}
        className={`${input} pr-28`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label="Tampilkan password"
        className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-medium text-accent hover:bg-surface"
      >
        {visible ? "Sembunyikan" : "Lihat"}
      </button>
    </div>
  );
}
