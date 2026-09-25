"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type EditMode = "companies" | "sidebar" | null;
const Context = createContext<{
  mode: EditMode;
  setMode: (mode: EditMode) => void;
} | null>(null);

export function DirectoryEditModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<EditMode>(null);
  return <Context.Provider value={{ mode, setMode }}>{children}</Context.Provider>;
}

export function useDirectoryEditMode() {
  const context = useContext(Context);
  if (!context) throw new Error("Directory editors require their shared provider.");
  return context;
}
