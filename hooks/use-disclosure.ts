"use client";

import { useCallback, useMemo, useState } from "react";

export interface Disclosure {
  isOpen: boolean;
  toggle: () => void;
}

export function useDisclosure(): Disclosure {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  return useMemo(() => ({ isOpen, toggle }), [isOpen, toggle]);
}
