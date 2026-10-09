"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Existing values offered as you type (e.g. authors already in your library). */
  suggestions?: string[];
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Several values in one field: type and press Enter or comma to add, Backspace to remove the last. */
export function TagInput({ id, value, onChange, suggestions = [], placeholder, ...aria }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  const add = (text: string) => {
    const parts = text.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  };

  return (
    <div
      className={cn(
        "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        aria["aria-invalid"] && "border-destructive",
      )}
    >
      {value.map((v) => (
        <span key={v} className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary pr-1 pl-2.5 text-sm text-secondary-foreground">
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            aria-label={`Remove ${v}`}
            className="grid size-5 place-items-center rounded-full hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={suggestions.length ? listId : undefined}
        value={draft}
        onChange={(e) => {
          // Picking a suggestion from the list (not typing) replaces the text in one go: add it straight away.
          const v = e.target.value;
          const inputType = (e.nativeEvent as InputEvent).inputType;
          const picked = inputType === undefined || inputType === "insertReplacementText";
          if (picked && suggestions.includes(v)) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/[,;]/.test(text)) {
            e.preventDefault();
            add(text);
          }
        }}
        placeholder={value.length ? "" : placeholder}
        className="h-7 min-w-32 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        {...aria}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
