"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ASSISTANCE_CATEGORY_ORDER,
  CATEGORY_LABEL,
  allAssistanceExercises,
  assistanceDisplayName,
  exercisesForCategory,
  resolveAssistanceExercise,
  type AssistanceCategory,
  type CustomAssistanceExercise,
} from "@/lib/domain/assistanceCatalog";

export type AssistanceExercisePickerHandle = {
  /** Resolve current text; creates custom exercises when allowCreateOnCommit is true. */
  commit: () => string;
};

type AssistanceExercisePickerProps = {
  customExercises: CustomAssistanceExercise[];
  exerciseId: string;
  onExerciseIdChange: (id: string) => void;
  onCreateCustom?: (exercise: CustomAssistanceExercise) => void;
  category?: AssistanceCategory;
  allCategories?: boolean;
  /** Match existing exercises when the field loses focus. */
  commitOnBlur?: boolean;
  /** Allow saving new custom exercises when commit() runs (e.g. Add to workout). */
  allowCreateOnCommit?: boolean;
  /** Allow saving new custom exercises on blur / Enter. */
  allowCreateOnBlur?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

export const AssistanceExercisePicker = forwardRef<
  AssistanceExercisePickerHandle,
  AssistanceExercisePickerProps
>(function AssistanceExercisePicker(
  {
    customExercises,
    exerciseId,
    onExerciseIdChange,
    onCreateCustom,
    category,
    allCategories = false,
    commitOnBlur = false,
    allowCreateOnCommit = true,
    allowCreateOnBlur = false,
    className = "min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-white",
    placeholder = "Movement…",
    "aria-label": ariaLabel = "Movement",
  },
  ref,
) {
  const listId = useId();
  const [text, setText] = useState(() =>
    exerciseId ? assistanceDisplayName(exerciseId, customExercises) : "",
  );
  const skipBlurCommitRef = useRef(false);
  const exerciseIdRef = useRef(exerciseId);
  exerciseIdRef.current = exerciseId;

  useEffect(() => {
    setText(
      exerciseId ? assistanceDisplayName(exerciseId, customExercises) : "",
    );
  }, [exerciseId, customExercises]);

  const options = allCategories
    ? allAssistanceExercises(customExercises)
    : category
      ? exercisesForCategory(category, customExercises)
      : [];

  function commitTypedText(
    forCategory: AssistanceCategory,
    allowCreate: boolean,
  ): string {
    const trimmed = text.trim();
    if (!trimmed) {
      onExerciseIdChange("");
      return "";
    }
    const result = resolveAssistanceExercise(
      trimmed,
      forCategory,
      customExercises,
      { createIfMissing: allowCreate },
    );
    if (result.kind === "invalid") {
      onExerciseIdChange("");
      return "";
    }
    if (result.kind === "created") {
      onCreateCustom?.(result.exercise);
      onExerciseIdChange(result.exercise.id);
      setText(
        assistanceDisplayName(result.exercise.id, [
          ...customExercises,
          result.exercise,
        ]),
      );
      return result.exercise.id;
    }
    onExerciseIdChange(result.exerciseId);
    setText(assistanceDisplayName(result.exerciseId, customExercises));
    return result.exerciseId;
  }

  useImperativeHandle(ref, () => ({
    commit: () => {
      if (!category) return exerciseIdRef.current;
      return commitTypedText(category, allowCreateOnCommit);
    },
  }));

  function handleBlur() {
    if (!commitOnBlur || !category || skipBlurCommitRef.current) return;
    commitTypedText(category, allowCreateOnBlur);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && category) {
      e.preventDefault();
      commitTypedText(category, allowCreateOnBlur);
    }
  }

  return (
    <>
      <input
        type="text"
        list={listId}
        className={className}
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseDown={() => {
          skipBlurCommitRef.current = false;
        }}
      />
      <datalist
        id={listId}
        onMouseDown={() => {
          skipBlurCommitRef.current = true;
        }}
      >
        {options.map((ex) => (
          <option
            key={ex.id}
            value={
              allCategories
                ? `${ex.name} (${CATEGORY_LABEL[ex.category]})`
                : ex.name
            }
          />
        ))}
      </datalist>
    </>
  );
});

export function resolveBulkAddExercise(
  input: string,
  category: AssistanceCategory,
  customExercises: CustomAssistanceExercise[],
  options?: { createIfMissing?: boolean },
): ReturnType<typeof resolveAssistanceExercise> {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "invalid" };

  for (const cat of ASSISTANCE_CATEGORY_ORDER) {
    const suffix = ` (${CATEGORY_LABEL[cat]})`;
    if (trimmed.endsWith(suffix)) {
      const name = trimmed.slice(0, -suffix.length).trim();
      return resolveAssistanceExercise(name, cat, customExercises, options);
    }
  }

  return resolveAssistanceExercise(trimmed, category, customExercises, options);
}
