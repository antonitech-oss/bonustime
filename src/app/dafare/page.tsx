"use client";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Icon, ICONS } from "@/components/Icon";
import { TodoRow } from "@/components/TodoRow";

export default function DafarePage() {
  const { data, addTodo, updateTodo, toggleTodo, removeTodo } = useStore();

  const [testo, setTesto] = useState("");
  const [dataVal, setDataVal] = useState("");
  const [oraVal, setOraVal] = useState("");
  const [amicoId, setAmicoId] = useState<number | "">("");
  const [book, setBook] = useState("");
  const [showForm, setShowForm] = useState(false);

  const todosPending = data.todos
    .filter((t) => !t.fatto)
    .sort((a, b) => {
      if (a.data && b.data) return a.data.localeCompare(b.data);
      if (a.data) return -1;
      if (b.data) return 1;
      return a.creato.localeCompare(b.creato);
    });
  const todosDone = data.todos
    .filter((t) => t.fatto)
    .sort((a, b) => b.creato.localeCompare(a.creato));

  const handleAdd = () => {
    if (!testo.trim()) return;
    addTodo({
      testo: testo.trim(),
      data: dataVal || undefined,
      ora: oraVal || undefined,
      amicoId: amicoId !== "" ? amicoId : undefined,
      book: book || undefined,
    });
    setTesto(""); setDataVal(""); setOraVal(""); setAmicoId(""); setBook("");
    setShowForm(false);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-txt-primary">Da fare</h1>
            <p className="text-xs text-txt-secondary mt-0.5">
              {todosPending.length > 0 ? `${todosPending.length} in sospeso` : "Tutto a posto 🎉"}
            </p>
          </div>
          <button className="btn btn-lime" onClick={() => setShowForm((v) => !v)}>
            <Icon d={ICONS.plus} size={14} /> Nuovo
          </button>
        </div>

        {/* Form aggiungi */}
        {showForm && (
          <div className="card p-4 mb-5 space-y-3">
            <input
              className="input"
              placeholder="Descrizione task…"
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="date" value={dataVal}
                onChange={(e) => setDataVal(e.target.value)} />
              <input className="input" type="time" value={oraVal}
                onChange={(e) => setOraVal(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={amicoId}
                onChange={(e) => setAmicoId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">— ID —</option>
                {data.amici.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <select className="input" value={book}
                onChange={(e) => setBook(e.target.value)}>
                <option value="">— Book —</option>
                {data.righeBook.map((r) => <option key={r.book} value={r.book}>{r.book}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-lime flex-1" onClick={handleAdd}>
                Aggiungi
              </button>
              <button className="btn bg-bg-hover text-txt-secondary hover:text-txt-primary px-4"
                onClick={() => setShowForm(false)}>
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Lista pending */}
        {todosPending.length > 0 && (
          <div className="card overflow-hidden mb-4">
            {todosPending.map((t, i) => (
              <TodoRow
                key={t.id}
                t={t}
                amici={data.amici}
                righeBook={data.righeBook}
                today={today}
                border={i < todosPending.length - 1}
                onToggle={() => toggleTodo(t.id)}
                onRemove={() => removeTodo(t.id)}
                onUpdate={(patch) => updateTodo(t.id, patch)}
              />
            ))}
          </div>
        )}

        {todosPending.length === 0 && !showForm && (
          <div className="text-center text-txt-secondary text-sm py-12">
            Nessun task in sospeso 🎉
          </div>
        )}

        {/* Completate */}
        {todosDone.length > 0 && (
          <div>
            <p className="label-tiny mb-3">Completate ({todosDone.length})</p>
            <div className="card overflow-hidden opacity-50">
              {todosDone.slice(0, 20).map((t, i) => {
                const amico = t.amicoId ? data.amici.find((a) => a.id === t.amicoId) : null;
                return (
                  <div key={t.id}
                    className={`flex items-center gap-3 px-4 py-2.5 ${i < Math.min(todosDone.length, 20) - 1 ? "border-b border-bord/50" : ""}`}>
                    <button onClick={() => toggleTodo(t.id)}
                      className="w-4 h-4 rounded bg-lime/20 border border-lime shrink-0 flex items-center justify-center">
                      <Icon d={ICONS.check} size={10} className="text-lime" />
                    </button>
                    <span className="flex-1 min-w-0 text-sm line-through text-txt-secondary truncate">{t.testo}</span>
                    {amico && <span className="text-[10px] text-txt-secondary shrink-0">{amico.nome}</span>}
                    <button onClick={() => removeTodo(t.id)}
                      className="text-txt-secondary hover:text-acc-red p-1 shrink-0">
                      <Icon d={ICONS.trash} size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
