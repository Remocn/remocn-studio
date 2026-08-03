"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { useFolderPicker } from "@/hooks/use-folder-picker";
import {
  DEFAULT_FORMAT,
  formatById,
  type VideoFormat,
} from "@/lib/studio/formats";
import type { Project, ProjectDraft } from "@/shared/ipc";

const PICKER_TITLE = "Where should the project live?";

export interface NewProject {
  canCreate: boolean;
  close: () => void;
  format: VideoFormat;
  isOpen: boolean;
  name: string;
  onFormatChange: (id: string) => void;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: () => void;
  parent: string | null;
  pickParent: () => void;
  submit: () => void;
}

export function useNewProject(
  create: (draft: ProjectDraft, format: VideoFormat) => Promise<Project | null>
): NewProject {
  const { pick } = useFolderPicker(PICKER_TITLE);
  const [isOpen, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parent, setParent] = useState<string | null>(null);
  const [format, setFormat] = useState<VideoFormat>(DEFAULT_FORMAT);

  const open = useCallback(() => {
    setName("");
    setParent(null);
    setFormat(DEFAULT_FORMAT);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
  }, []);

  const onFormatChange = useCallback((id: string) => {
    setFormat(formatById(id));
  }, []);

  const pickParent = useCallback(async () => {
    const picked = await pick();
    if (picked !== null) {
      setParent(picked);
    }
  }, [pick]);

  const trimmed = name.trim();
  const canCreate = trimmed.length > 0 && parent !== null;

  const submit = useCallback(async () => {
    if (parent === null || trimmed.length === 0) {
      return;
    }
    setOpen(false);
    await create({ name: trimmed, parent }, format);
  }, [create, format, parent, trimmed]);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit]
  );

  return useMemo(
    () => ({
      canCreate,
      close,
      format,
      isOpen,
      name,
      onFormatChange,
      onNameChange,
      onSubmit,
      open,
      parent,
      pickParent,
      submit,
    }),
    [
      canCreate,
      close,
      format,
      isOpen,
      name,
      onFormatChange,
      onNameChange,
      onSubmit,
      open,
      parent,
      pickParent,
      submit,
    ]
  );
}
