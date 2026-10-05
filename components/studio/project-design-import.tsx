"use client";

import { open } from "@tauri-apps/plugin-dialog";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { errorMessage } from "@/lib/error-message";
import { importProjectDesign } from "@/lib/studio/projects";
import type { ProjectBrand } from "@/shared/brand";
import {
  applyDesignImport,
  type DesignImport,
  type DesignSelection,
  initialDesignSelection,
  selectionError,
} from "@/shared/design-import";
import { DesignDropZone } from "./design-drop-zone";
import { DesignImportReview } from "./design-import-review";

export function ProjectDesignImport({
  value,
  projectId,
  onChange,
  onBusyChange,
  compact = false,
  onReviewChange,
}: {
  value: ProjectBrand | null;
  projectId: string;
  onChange: (brand: ProjectBrand) => void;
  onBusyChange: (busy: boolean) => void;
  compact?: boolean;
  onReviewChange?: (reviewing: boolean) => void;
}) {
  const { run, error } = useAsyncAction();
  const [pending, setPending] = useState<{
    data: DesignImport;
    selection: DesignSelection;
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);
  const reviewing = pending !== null;
  const container = useRef<HTMLFieldSetElement>(null);
  const wasReviewing = useRef(false);
  useEffect(() => {
    onReviewChange?.(reviewing);
  }, [reviewing, onReviewChange]);
  useEffect(() => {
    if (reviewing) {
      container.current?.focus({ preventScroll: true });
      container.current?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    } else if (wasReviewing.current) {
      container.current
        ?.querySelector("button")
        ?.focus({ preventScroll: true });
    }
    wasReviewing.current = reviewing;
  }, [reviewing]);
  const busy = useRef(false);
  const load = useCallback(
    async (path?: string) => {
      if (busy.current) {
        return;
      }
      busy.current = true;
      setLoading(true);
      onBusyChange(true);
      setLocalError(null);
      try {
        const selected =
          path ??
          (await open({
            filters: [{ extensions: ["md"], name: "Markdown" }],
            multiple: false,
            title: "Import DESIGN.md",
          }));
        if (!selected) {
          return;
        }
        const data = await run(importProjectDesign(projectId, selected));
        if (data) {
          setPending({ data, selection: initialDesignSelection(data, value) });
        }
      } catch (cause) {
        setLocalError(errorMessage(cause));
      } finally {
        busy.current = false;
        setLoading(false);
        onBusyChange(false);
      }
    },
    [onBusyChange, projectId, run, value]
  );
  const choose = useCallback(() => {
    load();
  }, [load]);
  const cancel = useCallback(() => setPending(null), []);
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value: text } = event.currentTarget;
      const checked =
        event.currentTarget instanceof HTMLInputElement &&
        event.currentTarget.checked;
      const [kind, index] = name.split(":");
      setPending((current) => {
        if (!current) {
          return current;
        }
        const selection = { ...current.selection };
        if (kind === "name") {
          selection.name = checked;
        }
        if (kind === "color" || kind === "role") {
          selection.colors = selection.colors.map((entry, i) =>
            i === Number(index)
              ? {
                  ...entry,
                  ...(kind === "color"
                    ? { selected: checked }
                    : { role: text, selected: false }),
                }
              : entry
          );
        }
        if (kind === "font" && ["display", "body", "mono"].includes(index)) {
          const font = current.data.fonts.find(
            (entry) => entry.family === text
          );
          selection.fonts = selection.fonts.filter(
            (entry) => entry.role && entry.role !== index
          );
          if (font) {
            selection.fonts = [
              ...selection.fonts,
              { role: index as "display" | "body" | "mono", token: font.token },
            ];
          }
        }
        return { ...current, selection };
      });
    },
    []
  );
  const apply = useCallback(() => {
    if (!pending || selectionError(pending.selection)) {
      return;
    }
    onChange(applyDesignImport(value, pending.data, pending.selection));
    setImported(true);
    setPending(null);
  }, [onChange, pending, value]);
  return (
    <fieldset
      className="grid min-w-0 gap-4 outline-none"
      ref={container}
      tabIndex={-1}
    >
      <legend className="sr-only">Design import</legend>
      {pending ? (
        <DesignImportReview
          current={value}
          data={pending.data}
          loading={loading}
          onApply={apply}
          onCancel={cancel}
          onChange={change}
          onReplace={choose}
          selection={pending.selection}
        />
      ) : (
        <DesignDropZone
          compact={compact || (imported && value?.design !== undefined)}
          filename={value?.design?.file.source}
          loading={loading}
          onChoose={choose}
          onDrop={load}
          onError={setLocalError}
        />
      )}
      {error || localError ? (
        <p className="text-destructive text-sm" role="alert">
          {error ?? localError}
        </p>
      ) : null}
    </fieldset>
  );
}
