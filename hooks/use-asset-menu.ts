"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import type { Asset } from "@/shared/library";

export interface AssetCommands {
  remove: (slug: string) => Promise<void>;
  rename: (slug: string, name: string) => Promise<void>;
}

export interface AssetMenu {
  canRename: boolean;
  confirmRemove: () => void;
  isRemoving: boolean;
  isRenaming: boolean;
  name: string;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRenameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  openRemove: () => void;
  openRename: () => void;
  setRemoving: (open: boolean) => void;
  setRenaming: (open: boolean) => void;
}

export function useAssetMenu(asset: Asset, commands: AssetCommands): AssetMenu {
  const [isRenaming, setRenaming] = useState(false);
  const [isRemoving, setRemoving] = useState(false);
  const [name, setName] = useState(asset.name);

  const { remove, rename } = commands;
  const { slug } = asset;
  const given = asset.name;

  const openRename = useCallback(() => {
    setName(given);
    setRenaming(true);
  }, [given]);

  const openRemove = useCallback(() => setRemoving(true), []);

  const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
  }, []);

  const trimmed = name.trim();

  const submitRename = useCallback(async () => {
    if (trimmed.length === 0) {
      return;
    }

    setRenaming(false);
    await rename(slug, trimmed);
  }, [rename, slug, trimmed]);

  const onRenameSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitRename();
    },
    [submitRename]
  );

  const confirmRemove = useCallback(async () => {
    setRemoving(false);
    await remove(slug);
  }, [remove, slug]);

  return useMemo(
    () => ({
      canRename: trimmed.length > 0,
      confirmRemove,
      isRemoving,
      isRenaming,
      name,
      onNameChange,
      onRenameSubmit,
      openRemove,
      openRename,
      setRemoving,
      setRenaming,
    }),
    [
      confirmRemove,
      isRemoving,
      isRenaming,
      name,
      onNameChange,
      onRenameSubmit,
      openRemove,
      openRename,
      trimmed,
    ]
  );
}
