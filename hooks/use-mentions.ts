"use client";

import { Effect, Fiber } from "effect";
import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { listFolder, listProjectFiles } from "@/lib/studio/files";
import {
  isFolderQuery,
  type Mention,
  mentionAt,
  rankEntries,
  rankFiles,
  splitFolderQuery,
} from "@/lib/studio/mentions";
import { baseName } from "@/lib/studio/paths";
import type { DirectoryListing, ProjectFiles } from "@/shared/ipc";

const LIMIT = 12;

interface Listed extends DirectoryListing {
  asked: string;
}

export interface MentionItem {
  folder: boolean;
  hint: string;
  label: string;
  path: string;
}

export interface Mentions {
  active: number;
  close: () => void;
  error: string | null;
  isLoading: boolean;
  isOpen: boolean;
  items: readonly MentionItem[];
  keyed: number;
  note: string | null;
  onChoose: (event: MouseEvent<HTMLButtonElement>) => void;
  onHold: (event: MouseEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  onPoint: (event: MouseEvent<HTMLButtonElement>) => void;
  sync: (text: string, caret: number) => void;
}

export interface MentionSettings {
  isEnabled: boolean;
  onInsert: (mention: Mention, path: string) => void;
  onOpenFolder: (mention: Mention, folder: string) => void;
  projectId: string | null;
}

export function useMentions({
  isEnabled,
  onInsert,
  onOpenFolder,
  projectId,
}: MentionSettings): Mentions {
  const [mention, setMention] = useState<Mention | null>(null);
  const [active, setActive] = useState(0);
  const [keyed, setKeyed] = useState(0);
  const [files, setFiles] = useState<ProjectFiles | null>(null);
  const [listing, setListing] = useState<Listed | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissed = useRef<number | null>(null);

  const query = mention?.query ?? null;
  const wantsFolder = query !== null && isFolderQuery(query);
  const asked = wantsFolder ? splitFolderQuery(query).folder : null;

  useProjectFiles(projectId, query !== null && !wantsFolder, {
    setError,
    setFiles,
    setIsLoading,
  });

  useFolderListing(asked, { setError, setIsLoading, setListing });

  const items = useMemo(
    () => itemsFor(query, files, listing),
    [files, listing, query]
  );

  const held = useRef({ active, items, mention, onInsert, onOpenFolder });
  held.current = { active, items, mention, onInsert, onOpenFolder };

  const sync = useCallback(
    (text: string, caret: number) => {
      const found = isEnabled ? mentionAt(text, caret) : null;

      if (found === null) {
        dismissed.current = null;
        setMention(null);
        return;
      }

      if (dismissed.current === found.start) {
        return;
      }

      const current = held.current.mention;
      if (
        current !== null &&
        current.start === found.start &&
        current.query === found.query
      ) {
        return;
      }

      setActive(0);
      setMention(found);
    },
    [isEnabled]
  );

  const choose = useCallback((index: number) => {
    const { items: rows, mention: found } = held.current;
    const item = rows[index];

    if (found === null || item === undefined) {
      return;
    }

    if (item.folder) {
      const folder = item.path.endsWith("/") ? item.path : `${item.path}/`;
      held.current.onOpenFolder(found, folder);
      setActive(0);
      setMention({ query: folder, start: found.start });
      return;
    }

    dismissed.current = null;
    setMention(null);
    held.current.onInsert(found, item.path);
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const open = held.current.mention;
      if (open === null) {
        return false;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        dismissed.current = open.start;
        setMention(null);
        return true;
      }

      const count = held.current.items.length;
      if (count === 0) {
        return false;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : count - 1;
        setActive((current) => (current + step) % count);
        setKeyed((current) => current + 1);
        return true;
      }

      if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
        event.preventDefault();
        choose(Math.min(held.current.active, count - 1));
        return true;
      }

      return false;
    },
    [choose]
  );

  const onChoose = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      choose(Number(event.currentTarget.value));
    },
    [choose]
  );

  const onPoint = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setActive(Number(event.currentTarget.value));
  }, []);

  const close = useCallback(() => {
    dismissed.current = null;
    setMention(null);
  }, []);

  const onHold = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  const note =
    !(wantsFolder || isLoading) &&
    items.length === 0 &&
    files?.truncated === true
      ? "This project has more files than the list holds — type an absolute path to reach the rest."
      : null;

  return useMemo(
    () => ({
      active: Math.min(active, Math.max(items.length - 1, 0)),
      close,
      error,
      isLoading,
      isOpen: mention !== null,
      items,
      keyed,
      note,
      onChoose,
      onHold,
      onKeyDown,
      onPoint,
      sync,
    }),
    [
      active,
      close,
      error,
      isLoading,
      items,
      keyed,
      mention,
      note,
      onChoose,
      onHold,
      onKeyDown,
      onPoint,
      sync,
    ]
  );
}

function itemsFor(
  query: string | null,
  files: ProjectFiles | null,
  listing: Listed | null
): MentionItem[] {
  if (query === null) {
    return [];
  }

  if (!isFolderQuery(query)) {
    return rankFiles(files?.files ?? [], query, LIMIT).map(fileItem);
  }

  const { folder, term } = splitFolderQuery(query);
  if (listing === null || listing.asked !== folder) {
    return [];
  }

  return rankEntries(listing.entries, term, LIMIT).map((entry) =>
    folderItem(listing.path, entry.name, entry.directory)
  );
}

function fileItem(path: string): MentionItem {
  const name = baseName(path);
  const at = path.length - name.length;

  return {
    folder: false,
    hint: at === 0 ? "" : path.slice(0, at - 1),
    label: name,
    path,
  };
}

function folderItem(
  folder: string,
  name: string,
  directory: boolean
): MentionItem {
  return {
    folder: directory,
    hint: folder,
    label: name,
    path: `${folder.endsWith("/") ? folder : `${folder}/`}${name}`,
  };
}

function useProjectFiles(
  projectId: string | null,
  isWanted: boolean,
  set: {
    setError: (message: string | null) => void;
    setFiles: (files: ProjectFiles | null) => void;
    setIsLoading: (loading: boolean) => void;
  }
) {
  const loaded = useRef<string | null>(null);
  const held = useRef(set);
  held.current = set;

  useEffect(() => {
    if (projectId === null) {
      loaded.current = null;
      held.current.setFiles(null);
      return;
    }

    if (!isWanted || loaded.current === projectId) {
      return;
    }

    loaded.current = projectId;
    held.current.setIsLoading(true);

    const fiber = Effect.runFork(
      listProjectFiles(projectId).pipe(
        Effect.tap((found) =>
          Effect.sync(() => {
            held.current.setFiles(found);
            held.current.setError(null);
          })
        ),
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            loaded.current = null;
            held.current.setError(causeMessage(cause));
          })
        ),
        Effect.ignore,
        Effect.ensuring(Effect.sync(() => held.current.setIsLoading(false)))
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [isWanted, projectId]);
}

function useFolderListing(
  asked: string | null,
  set: {
    setError: (message: string | null) => void;
    setIsLoading: (loading: boolean) => void;
    setListing: (listing: Listed | null) => void;
  }
) {
  const cache = useRef(new Map<string, Listed>());
  const held = useRef(set);
  held.current = set;

  useEffect(() => {
    if (asked === null) {
      return;
    }

    const known = cache.current.get(asked);
    if (known !== undefined) {
      held.current.setListing(known);
      held.current.setError(null);
      return;
    }

    held.current.setIsLoading(true);

    const fiber = Effect.runFork(
      listFolder(asked).pipe(
        Effect.tap((found) =>
          Effect.sync(() => {
            const kept = { ...found, asked };
            cache.current.set(asked, kept);
            held.current.setListing(kept);
            held.current.setError(null);
          })
        ),
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            held.current.setListing(null);
            held.current.setError(causeMessage(cause));
          })
        ),
        Effect.ignore,
        Effect.ensuring(Effect.sync(() => held.current.setIsLoading(false)))
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [asked]);
}
