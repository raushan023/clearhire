import { InlineLoader } from "./ui";
import { useEffect, useId, useState } from "react";
import { api } from "../lib/api";
import { useApiQuery } from "../lib/query";
import type { Named } from "../lib/types";
import { ErrorState } from "./ui";
export function SkillPicker({
  label,
  value,
  onChange,
  initialItems = [],
  error,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  initialItems?: Named[];
  error?: string;
}) {
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [names, setNames] = useState<Record<string, string>>({});
  const id = useId();
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useApiQuery(["skills", term], (signal) =>
    api.skills(term, signal),
  );
  useEffect(() => {
    if (query.data)
      setNames((previous) => ({
        ...previous,
        ...Object.fromEntries(query.data.skills.map((s) => [s.id, s.name])),
      }));
  }, [query.data]);
  return (
    <fieldset className="skill-picker">
      <legend>{label}</legend>
      <label className="field" htmlFor={id}>
        <span className="sr-only">Search {label.toLowerCase()}</span>
        <input
          id={id}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search canonical skills…"
        />
      </label>
      <div className="chips mb-3">
        {value.map((skillId) => (
          <span className="chip" key={skillId}>
            {names[skillId] ??
              initialItems.find((s) => s.id === skillId)?.name ??
              "Selected skill"}
            <button
              type="button"
              className="secondary"
              aria-label={`Remove ${names[skillId] ?? initialItems.find((s) => s.id === skillId)?.name ?? "skill"}`}
              onClick={() => onChange(value.filter((v) => v !== skillId))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {query.isPending && <InlineLoader text="Loading skills…" />}
      {query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      <div className="skill-options">
        {query.data?.skills.map((skill) => (
          <label className="check-option" key={skill.id}>
            <input
              type="checkbox"
              checked={value.includes(skill.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, skill.id]
                    : value.filter((v) => v !== skill.id),
                )
              }
            />
            {skill.name}
          </label>
        ))}
      </div>
      {query.data?.skills.length === 0 && (
        <p className="small muted">
          No canonical skills match. Try another search.
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
