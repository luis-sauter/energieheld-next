"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";

// Same text measure as the public paragraph, including when a pair changes width.
export function EditorialTextarea(props: ComponentProps<"textarea">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function fit() {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    fit();
    let width = field.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const next = field.getBoundingClientRect().width;
      if (next !== width) { width = next; fit(); }
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, []);
  return <textarea {...props} ref={ref} rows={1} onInput={(event) => { fit(); props.onInput?.(event); }} />;
}
