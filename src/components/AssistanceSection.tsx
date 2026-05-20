"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ASSISTANCE_CATEGORY_ORDER,
  CATEGORY_LABEL,
  assistanceCategoryOf,
  assistanceDisplayName,
  expandTemplateToLines,
  getAssistanceExercise,
  templateSetCount,
  type AssistanceCategory,
  type AssistanceTemplateByCategory,
  type AssistanceTemplateEntry,
  type CustomAssistanceExercise,
} from "@/lib/domain/assistanceCatalog";
import type { AssistanceSetRow } from "@/lib/db/schema";
import { optionalFiniteNumberFromInput } from "@/lib/numericInput";
import {
  AssistanceExercisePicker,
  type AssistanceExercisePickerHandle,
} from "@/components/AssistanceExercisePicker";

export type AssistanceLine = AssistanceSetRow & { clientKey: string };

export type AssistanceWorkItem = AssistanceLine & { completed: boolean };

const FLASH_MS = 1500;

export function newAssistanceLine(
  exerciseId: string,
  reps: number,
  weightKg: number | null,
): AssistanceLine {
  return {
    clientKey:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    exerciseId,
    reps,
    weightKg,
  };
}

export function expandToWorkItems(
  rows: Array<{ exerciseId: string; reps: number; weightKg: number | null }>,
  completed = false,
): AssistanceWorkItem[] {
  return rows.map((row) => ({
    ...newAssistanceLine(row.exerciseId, row.reps, row.weightKg),
    completed,
  }));
}

export function stripAssistanceLines(
  lines: AssistanceLine[],
): AssistanceSetRow[] {
  return lines
    .filter((l) => l.exerciseId && l.reps >= 1)
    .map(({ exerciseId, reps, weightKg }) => ({
      exerciseId,
      reps,
      weightKg,
    }));
}

function parseWeightKg(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
}

function formatWeightLabel(weightKg: number | null): string {
  return weightKg == null ? "BW" : `${weightKg} kg`;
}

type ExerciseIdGroup = {
  exerciseId: string;
  items: AssistanceWorkItem[];
};

function groupItemsByExerciseId(
  items: AssistanceWorkItem[],
): ExerciseIdGroup[] {
  const order: string[] = [];
  const map = new Map<string, AssistanceWorkItem[]>();
  for (const item of items) {
    if (!map.has(item.exerciseId)) {
      map.set(item.exerciseId, []);
      order.push(item.exerciseId);
    }
    map.get(item.exerciseId)!.push(item);
  }
  return order.map((exerciseId) => ({
    exerciseId,
    items: map.get(exerciseId)!,
  }));
}

function itemsForCategory(
  items: AssistanceWorkItem[],
  category: AssistanceCategory,
  customExercises: CustomAssistanceExercise[],
): AssistanceWorkItem[] {
  return items.filter(
    (item) =>
      assistanceCategoryOf(item.exerciseId, customExercises) === category,
  );
}

function firstTemplateEntryForCategory(
  category: AssistanceCategory,
  entries: AssistanceTemplateEntry[] | undefined,
  customExercises: CustomAssistanceExercise[],
): AssistanceTemplateEntry | undefined {
  if (!entries?.length) return undefined;
  return entries.find((e) => {
    const ex = getAssistanceExercise(e.exerciseId, customExercises);
    return ex?.category === category;
  });
}

function CategoryAssistanceBlock({
  category,
  templateEntries,
  items,
  onItemsChange,
  customExercises,
  onCreateCustom,
}: {
  category: AssistanceCategory;
  templateEntries?: AssistanceTemplateEntry[];
  items: AssistanceWorkItem[];
  onItemsChange: (next: AssistanceWorkItem[]) => void;
  customExercises: CustomAssistanceExercise[];
  onCreateCustom: (exercise: CustomAssistanceExercise) => void;
}) {
  const firstEntry = firstTemplateEntryForCategory(
    category,
    templateEntries,
    customExercises,
  );
  const [exerciseId, setExerciseId] = useState(
    () => firstEntry?.exerciseId ?? "",
  );
  const pickerRef = useRef<AssistanceExercisePickerHandle>(null);
  const [repsText, setRepsText] = useState(() =>
    firstEntry ? String(firstEntry.reps) : "10",
  );
  const [weightText, setWeightText] = useState(() =>
    firstEntry?.weightKg == null ? "" : String(firstEntry.weightKg),
  );
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  function showAddedFlash(message: string) {
    setAddedFlash(message);
    setJustAdded(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setAddedFlash(null);
      setJustAdded(false);
      flashTimerRef.current = null;
    }, FLASH_MS);
  }

  function addOneSet() {
    const resolvedId = pickerRef.current?.commit() || exerciseId;
    if (!resolvedId) return;
    const repsN = optionalFiniteNumberFromInput(repsText);
    if (
      repsN === undefined ||
      !Number.isFinite(repsN) ||
      repsN < 1
    )
      return;
    const reps = Math.floor(repsN);
    const w = parseWeightKg(weightText);
    if (w === undefined) return;
    onItemsChange([
      ...items,
      { ...newAssistanceLine(resolvedId, reps, w), completed: true },
    ]);
    showAddedFlash(
      `${assistanceDisplayName(resolvedId, customExercises)} · ${reps} reps · ${formatWeightLabel(w)} added`,
    );
  }

  const repsParsed = optionalFiniteNumberFromInput(repsText);
  const repsInputOk =
    repsParsed !== undefined &&
    Number.isFinite(repsParsed) &&
    repsParsed >= 1;

  return (
    <div className="space-y-3 border-b border-zinc-800/80 pb-5 last:border-0 last:pb-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90">
        {CATEGORY_LABEL[category]}
      </h3>
      <div className="flex flex-wrap items-end gap-2 sm:gap-3">
        <label className="min-w-[min(100%,14rem)] flex-1">
          <span className="sr-only">Movement</span>
          <AssistanceExercisePicker
            ref={pickerRef}
            category={category}
            customExercises={customExercises}
            exerciseId={exerciseId}
            onExerciseIdChange={setExerciseId}
            onCreateCustom={onCreateCustom}
          />
        </label>
        <label className="flex w-[4.5rem] flex-col gap-1 text-xs text-zinc-500">
          Reps
          <input
            type="number"
            min={1}
            max={999}
            inputMode="numeric"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white"
            value={repsText}
            onChange={(e) => setRepsText(e.target.value)}
          />
        </label>
        <label className="flex w-[5.5rem] flex-col gap-1 text-xs text-zinc-500">
          kg
          <input
            type="text"
            inputMode="decimal"
            placeholder="BW"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white placeholder:text-zinc-600"
            value={weightText}
            onChange={(e) => setWeightText(e.target.value)}
            aria-label="Weight in kg, leave empty for bodyweight"
          />
        </label>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
          onClick={addOneSet}
          disabled={
            justAdded ||
            !repsInputOk ||
            parseWeightKg(weightText) === undefined
          }
        >
          {justAdded ? "Added" : "Add to log"}
        </button>
      </div>
      {addedFlash ? (
        <p className="text-sm text-emerald-400" role="status" aria-live="polite">
          {addedFlash}
        </p>
      ) : null}
    </div>
  );
}

function BulkAddForm({
  customExercises,
  onCreateCustom,
  onAdd,
}: {
  customExercises: CustomAssistanceExercise[];
  onCreateCustom: (exercise: CustomAssistanceExercise) => void;
  onAdd: (rows: Array<{ exerciseId: string; reps: number; weightKg: number | null }>) => void;
}) {
  const [category, setCategory] = useState<AssistanceCategory>("push");
  const [exerciseId, setExerciseId] = useState("");
  const [setsText, setSetsText] = useState("5");
  const [repsText, setRepsText] = useState("10");
  const [weightText, setWeightText] = useState("");
  const pickerRef = useRef<AssistanceExercisePickerHandle>(null);

  function handleAdd() {
    const resolvedId = pickerRef.current?.commit() || exerciseId;
    if (!resolvedId) return;
    const setsN = optionalFiniteNumberFromInput(setsText);
    const repsN = optionalFiniteNumberFromInput(repsText);
    if (
      setsN === undefined ||
      !Number.isFinite(setsN) ||
      setsN < 1 ||
      repsN === undefined ||
      !Number.isFinite(repsN) ||
      repsN < 1
    ) {
      return;
    }
    const w = parseWeightKg(weightText);
    if (w === undefined) return;
    const sets = Math.floor(setsN);
    const reps = Math.floor(repsN);
    const rows = Array.from({ length: sets }, () => ({
      exerciseId: resolvedId,
      reps,
      weightKg: w,
    }));
    onAdd(rows);
    setExerciseId("");
    setSetsText("5");
    setRepsText("10");
    setWeightText("");
  }

  const setsParsed = optionalFiniteNumberFromInput(setsText);
  const repsParsed = optionalFiniteNumberFromInput(repsText);
  const canAdd =
    setsParsed !== undefined &&
    setsParsed >= 1 &&
    repsParsed !== undefined &&
    repsParsed >= 1 &&
    parseWeightKg(weightText) !== undefined;

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <h3 className="text-sm font-medium text-zinc-300">Bulk add</h3>
      <p className="text-sm text-zinc-500">
        Sets and reps are starting values — edit each set in the checklist
        before checking off.
      </p>
      <div className="flex flex-wrap items-end gap-2 sm:gap-3">
        <label className="min-w-[min(100%,10rem)] flex-1">
          <span className="mb-1 block text-xs text-zinc-500">Category</span>
          <select
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-white"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as AssistanceCategory);
              setExerciseId("");
            }}
          >
            {ASSISTANCE_CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABEL[cat]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[min(100%,14rem)] flex-[2]">
          <span className="mb-1 block text-xs text-zinc-500">Movement</span>
          <AssistanceExercisePicker
            ref={pickerRef}
            key={category}
            category={category}
            customExercises={customExercises}
            exerciseId={exerciseId}
            onExerciseIdChange={setExerciseId}
            onCreateCustom={onCreateCustom}
            allowCreateOnCommit
          />
        </label>
        <label className="flex w-[4.5rem] flex-col gap-1 text-xs text-zinc-500">
          Sets
          <input
            type="number"
            min={1}
            max={99}
            inputMode="numeric"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white"
            value={setsText}
            onChange={(e) => setSetsText(e.target.value)}
          />
        </label>
        <label className="flex w-[4.5rem] flex-col gap-1 text-xs text-zinc-500">
          Reps
          <input
            type="number"
            min={1}
            max={999}
            inputMode="numeric"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white"
            value={repsText}
            onChange={(e) => setRepsText(e.target.value)}
          />
        </label>
        <label className="flex w-[5.5rem] flex-col gap-1 text-xs text-zinc-500">
          kg
          <input
            type="text"
            inputMode="decimal"
            placeholder="BW"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white placeholder:text-zinc-600"
            value={weightText}
            onChange={(e) => setWeightText(e.target.value)}
            aria-label="Weight in kg, leave empty for bodyweight"
          />
        </label>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl border border-emerald-700/60 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-950/40 disabled:opacity-40"
          onClick={handleAdd}
          disabled={!canAdd}
        >
          Add to workout
        </button>
      </div>
    </div>
  );
}

function ChecklistSetRow({
  item,
  setIndex,
  repsDraft,
  onRepsDraftChange,
  onRepsDraftClear,
  onToggle,
  onUpdateItem,
}: {
  item: AssistanceWorkItem;
  setIndex: number;
  repsDraft: string | undefined;
  onRepsDraftChange: (clientKey: string, raw: string) => void;
  onRepsDraftClear: (clientKey: string) => void;
  onToggle: (clientKey: string, completed: boolean) => void;
  onUpdateItem: (
    clientKey: string,
    patch: Partial<Pick<AssistanceWorkItem, "reps" | "weightKg">>,
  ) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:min-w-[5.5rem]">
        <input
          type="checkbox"
          className="touch-checkbox accent-emerald-500"
          checked={item.completed}
          onChange={(e) => onToggle(item.clientKey, e.target.checked)}
        />
        <span className="text-base font-medium text-zinc-300">
          Set {setIndex + 1}
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:ml-auto">
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          Reps
          <input
            type="number"
            min={1}
            max={999}
            className="w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white"
            value={repsDraft ?? String(item.reps)}
            onChange={(e) => {
              const raw = e.target.value;
              onRepsDraftChange(item.clientKey, raw);
              const n = optionalFiniteNumberFromInput(raw);
              if (n !== undefined) {
                onUpdateItem(item.clientKey, {
                  reps: Math.max(1, Math.floor(n)),
                });
              }
            }}
            onBlur={() => onRepsDraftClear(item.clientKey)}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          kg
          <input
            type="text"
            inputMode="decimal"
            placeholder="BW"
            className="w-20 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white placeholder:text-zinc-600"
            value={item.weightKg === null ? "" : String(item.weightKg)}
            onChange={(e) => {
              const v = parseWeightKg(e.target.value);
              if (v !== undefined) {
                onUpdateItem(item.clientKey, { weightKg: v });
              }
            }}
            aria-label="Weight kg, empty for BW"
          />
        </label>
      </div>
    </div>
  );
}

function ChecklistByCategory({
  category,
  items,
  customExercises,
  repsDraftByKey,
  onRepsDraftChange,
  onRepsDraftClear,
  onToggle,
  onUpdateItem,
}: {
  category: AssistanceCategory;
  items: AssistanceWorkItem[];
  customExercises: CustomAssistanceExercise[];
  repsDraftByKey: Record<string, string>;
  onRepsDraftChange: (clientKey: string, raw: string) => void;
  onRepsDraftClear: (clientKey: string) => void;
  onToggle: (clientKey: string, completed: boolean) => void;
  onUpdateItem: (
    clientKey: string,
    patch: Partial<Pick<AssistanceWorkItem, "reps" | "weightKg">>,
  ) => void;
}) {
  const categoryItems = itemsForCategory(items, category, customExercises);
  if (categoryItems.length === 0) return null;

  const groups = groupItemsByExerciseId(categoryItems);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90">
        {CATEGORY_LABEL[category]}
      </h3>
      {groups.map((group) => (
        <div key={group.exerciseId} className="space-y-3">
          <div className="flex flex-wrap justify-between gap-3 text-base sm:text-lg">
            <span className="font-medium text-zinc-300">
              {assistanceDisplayName(group.exerciseId, customExercises)}
            </span>
            <span className="font-medium text-emerald-300">
              {group.items.length} set{group.items.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="space-y-2">
            {group.items.map((item, setIdx) => (
              <li key={item.clientKey}>
                <ChecklistSetRow
                  item={item}
                  setIndex={setIdx}
                  repsDraft={repsDraftByKey[item.clientKey]}
                  onRepsDraftChange={onRepsDraftChange}
                  onRepsDraftClear={onRepsDraftClear}
                  onToggle={onToggle}
                  onUpdateItem={onUpdateItem}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AssistanceSection({
  hint,
  notes,
  onNotesChange,
  items,
  onItemsChange,
  templateByCategory = {},
  customExercises,
  onCustomExercisesChange,
}: {
  hint: string;
  notes: string;
  onNotesChange: (v: string) => void;
  items: AssistanceWorkItem[];
  onItemsChange: (next: AssistanceWorkItem[]) => void;
  templateByCategory?: AssistanceTemplateByCategory;
  customExercises: CustomAssistanceExercise[];
  onCustomExercisesChange: (next: CustomAssistanceExercise[]) => void;
}) {
  const [statusFlash, setStatusFlash] = useState<string | null>(null);
  const [repsDraftByKey, setRepsDraftByKey] = useState<Record<string, string>>(
    {},
  );
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCreateCustom(exercise: CustomAssistanceExercise) {
    if (customExercises.some((c) => c.id === exercise.id)) return;
    if (
      customExercises.some(
        (c) =>
          c.category === exercise.category &&
          c.name.toLowerCase() === exercise.name.toLowerCase(),
      )
    ) {
      return;
    }
    onCustomExercisesChange(
      [...customExercises, exercise].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
  }

  const templateSetTotal = templateSetCount(templateByCategory);
  const hasTemplate = templateSetTotal > 0;
  const hasChecklistItems = items.length > 0;

  const completedCount = useMemo(
    () => items.filter((i) => i.completed).length,
    [items],
  );

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  function showStatusFlash(message: string) {
    setStatusFlash(message);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setStatusFlash(null);
      flashTimerRef.current = null;
    }, FLASH_MS);
  }

  function appendUnchecked(
    rows: Array<{ exerciseId: string; reps: number; weightKg: number | null }>,
  ) {
    if (rows.length === 0) return;
    onItemsChange([...items, ...expandToWorkItems(rows, false)]);
  }

  function loadTemplate() {
    const expanded = expandTemplateToLines(templateByCategory);
    onItemsChange(expandToWorkItems(expanded, false));
    showStatusFlash(
      `Template loaded — ${expanded.length} set${expanded.length === 1 ? "" : "s"}`,
    );
  }

  function toggleItem(clientKey: string, completed: boolean) {
    onItemsChange(
      items.map((item) =>
        item.clientKey === clientKey ? { ...item, completed } : item,
      ),
    );
  }

  function updateItem(
    clientKey: string,
    patch: Partial<Pick<AssistanceWorkItem, "reps" | "weightKg">>,
  ) {
    onItemsChange(
      items.map((item) =>
        item.clientKey === clientKey ? { ...item, ...patch } : item,
      ),
    );
  }

  function markAllDone() {
    onItemsChange(items.map((item) => ({ ...item, completed: true })));
  }

  function clearChecklist() {
    setRepsDraftByKey({});
    onItemsChange([]);
  }

  return (
    <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-white sm:text-xl">Assistance</h2>
          <p className="mt-1 text-sm text-zinc-400 sm:text-base">{hint}</p>
        </div>
        {hasChecklistItems ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2 text-base font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700"
              onClick={markAllDone}
            >
              Mark all done
            </button>
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-xl border border-zinc-600 px-4 py-2 text-base font-medium text-zinc-300 hover:bg-zinc-900"
              onClick={clearChecklist}
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {hasTemplate && !hasChecklistItems ? (
        <button
          type="button"
          className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
          onClick={loadTemplate}
        >
          Load template ({templateSetTotal} sets)
        </button>
      ) : hasTemplate && hasChecklistItems ? (
        <p className="text-sm text-zinc-500">
          Clear all to reload your template.
        </p>
      ) : null}

      <BulkAddForm
        customExercises={customExercises}
        onCreateCustom={handleCreateCustom}
        onAdd={(rows) => {
          appendUnchecked(rows);
          showStatusFlash(
            `Added ${rows.length} set${rows.length === 1 ? "" : "s"} to workout`,
          );
        }}
      />

      {statusFlash ? (
        <p className="text-sm text-emerald-400" role="status" aria-live="polite">
          {statusFlash}
        </p>
      ) : null}

      {hasChecklistItems ? (
        <div className="space-y-6 border-t border-zinc-800 pt-5">
          <p className="text-sm text-zinc-400">
            {completedCount} of {items.length} sets checked off
          </p>
          {ASSISTANCE_CATEGORY_ORDER.map((cat) => (
            <ChecklistByCategory
              key={cat}
              category={cat}
              items={items}
              customExercises={customExercises}
              repsDraftByKey={repsDraftByKey}
              onRepsDraftChange={(clientKey, raw) =>
                setRepsDraftByKey((d) => ({ ...d, [clientKey]: raw }))
              }
              onRepsDraftClear={(clientKey) =>
                setRepsDraftByKey((d) => {
                  const { [clientKey]: _, ...rest } = d;
                  return rest;
                })
              }
              onToggle={toggleItem}
              onUpdateItem={updateItem}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Load your template or bulk-add exercises to start — adjust reps and
          weight per set, then check off as you go.
        </p>
      )}

      <div className="space-y-6 border-t border-zinc-800 pt-5">
        <h3 className="text-sm font-medium text-zinc-300">Add single set</h3>
        {ASSISTANCE_CATEGORY_ORDER.map((cat) => (
          <CategoryAssistanceBlock
            key={cat}
            category={cat}
            templateEntries={templateByCategory[cat]}
            items={items}
            onItemsChange={onItemsChange}
            customExercises={customExercises}
            onCreateCustom={handleCreateCustom}
          />
        ))}
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-zinc-400">Notes (optional)</span>
        <textarea
          className="min-h-[88px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-base leading-relaxed text-white"
          placeholder="Anything else…"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </label>
    </section>
  );
}
