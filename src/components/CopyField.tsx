"use client";
import { useState } from "react";
import { Icon, ICONS } from "./Icon";

export function CopyField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange?: (v: string) => void; type?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <label className="block">
      <span className="label-tiny">{label}</span>
      <div className="flex gap-1 mt-1">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={!onChange}
          className="input flex-1"
        />
        <button type="button" onClick={copy} className="btn btn-ghost px-2 shrink-0" title="Copia">
          {copied ? <span className="text-lime text-xs">✓</span> : <Icon d={ICONS.copy} size={15} />}
        </button>
      </div>
    </label>
  );
}
