"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { useFolderPicker } from "@/hooks/use-folder-picker";
import type { Project, ProjectDraft } from "@/shared/ipc";

const PICKER_TITLE = "Where should the project live?";

export interface NewProject {
  canCreate: boolean;
  isOpen: boolean;
  name: string;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: () => void;
  parent: string | null;
  pickParent: () => void;
  setOpen: (isOpen: boolean) => void;
  submit: () => void;
}

export function useNewProject(
  create: (draft: ProjectDraft) => Promise<Project | null>
): NewProject {
  const { pick } = useFolderPicker(PICKER_TITLE);
  const [isOpen, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parent, setParent] = useState<string | null>(null);

  const open = useCallback(() => {
    setName("");
    setParent(null);
    setOpen(true);
  }, []);

  const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
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
    await create({ name: trimmed, parent });
  }, [create, parent, trimmed]);

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
      isOpen,
      name,
      onNameChange,
      onSubmit,
      open,
      parent,
      pickParent,
      setOpen,
      submit,
    }),
    [
      canCreate,
      isOpen,
      name,
      onNameChange,
      onSubmit,
      open,
      parent,
      pickParent,
      submit,
    ]
  );
}
