"use client";

import { useCallback, useMemo, useState } from "react";

export interface Disclosure {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export function useDisclosure(): Disclosure {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const setOpen = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return useMemo(
    () => ({ isOpen, setOpen, toggle }),
    [isOpen, setOpen, toggle]
  );
}
