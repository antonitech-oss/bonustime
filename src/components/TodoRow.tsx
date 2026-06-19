"use client";
import { useState } from "react";
import type { TodoItem } from "@/lib/types";
import { Icon, ICONS } from "./Icon";

export function TodoRow({ t, amici, righeBook, today, border, onToggle, onRemove, onUpdate }: {
  t: TodoItem;
  amici: any[];
  righeBook: any[];
  today: string;
  border: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<Pick<TodoItem, "testo" | "data" | "ora" | "amicoId" | "book">>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    testo: t.testo,
    data: t.data || "",
    ora: t.ora || "",
    amicoId: t.amicoId ?? ("" as number | ""),
    book: t.book || "",
  });

  const amico = t.amicoId ? amici.find((a: any) => a.id === t.amicoId) : null;
  const isUrgent = t.data && t.data <= today;

  const calDate = (t.data || today).replace(/-/g, "");
  const calDetails = [amico?.nome, t.book].filter(Boolean).join(" · ");
  const calStart = t.ora ? `${calDate}T${t.ora.replace(":", "")}00` : calDate;
  const calEnd = t.ora
    ? `${calDate}T${String(parseInt(t.ora.split(":")[0]) + 1).padStart(2, "0")}${t.ora.split(":")[1]}00`
    : calDate;
  const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t.testo)}&dates=${calStart}/${calEnd}${calDetails ? `&details=${encodeURIComponent(calDetails)}` : ""}`;

  const handleSave = () => {
    onUpdate({
      testo: form.testo.trim() || t.testo,
      data: form.data || undefined,
      ora: form.ora || undefined,
      amicoId: form.amicoId !== "" ? (form.amicoId as number) : undefined,
      book: form.book || undefined,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`px-4 py-3 bg-bg-hover/20 ${border ? "border-b border-bord/50" : ""}`}>
        <input className="input mb-2 text-sm" value={form.testo} autoFocus
          onChange={(e) => setForm((f) => ({ ...f, testo: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }} />
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className="input text-xs" type="date" value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
          <input className="input text-xs" type="time" value={form.ora}
            onChange={(e) => setForm((f) => ({ ...f, ora: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select className="input text-xs" value={form.amicoId}
            onChange={(e) => setForm((f) => ({ ...f, amicoId: e.target.value === "" ? "" : Number(e.target.value) }))}>
            <option value="">— ID —</option>
            {amici.map((a: any) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <select className="input text-xs" value={form.book}
            onChange={(e) => setForm((f) => ({ ...f, book: e.target.value }))}>
            <option value="">— Book —</option>
            {righeBook.map((r: any) => <option key={r.book} value={r.book}>{r.book}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1 text-xs" onClick={() => setEditing(false)}>Annulla</button>
          <button className="btn btn-lime flex-1 text-xs" onClick={handleSave}>Salva</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${border ? "border-b border-bord/50" : ""}`}>
      <button onClick={onToggle}
        className="w-4 h-4 rounded border border-bord shrink-0 mt-0.5 hover:border-lime transition-colors" />
      <div className="flex-1 min-w-0">
        <div className="text-sm">{t.testo}</div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {amico && <span className="text-[10px] pill bg-acc-blue/10 text-acc-blue">{amico.nome}</span>}
          {t.book && <span className="text-[10px] pill bg-bord text-txt-secondary">{t.book}</span>}
          {t.data && (
            <span className={`text-[10px] pill ${isUrgent ? "bg-acc-red/15 text-acc-red" : "bg-bord text-txt-secondary"}`}>
              {t.data}{t.ora && ` ${t.ora}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={() => setEditing(true)} className="text-txt-secondary hover:text-lime p-1" title="Modifica">
          <Icon d={ICONS.edit} size={13} />
        </button>
        <a href={calUrl} target="_blank" rel="noreferrer" className="text-txt-secondary hover:text-lime p-1" title="Google Calendar">
          <Icon d={ICONS.calendar} size={14} />
        </a>
        <button onClick={onRemove} className="text-txt-secondary hover:text-acc-red p-1">
          <Icon d={ICONS.trash} size={14} />
        </button>
      </div>
    </div>
  );
}
