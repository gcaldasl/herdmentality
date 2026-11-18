"use client";

import { createContext, useContext } from "react";

/** Who holds the Pink Cow right now, so any avatar can mark them. */
export const CowHolderContext = createContext<string | null>(null);

export function useCowHolder(): string | null {
  return useContext(CowHolderContext);
}
