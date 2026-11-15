"use client";
// Accessible modal on the native <dialog>: focus trapped by the browser, Escape closes,
// focus returns to the opener, labelled by its title.
import { useEffect, useId, useRef } from "react";
import { useT } from "@/i18n/I18nProvider";

// Last input modality (pointer vs keyboard), for focus restoration without a stray ring.
let lastInput: "pointer" | "key" = "pointer";
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => (lastInput = "pointer"), true);
  window.addEventListener("keydown", (e) => { if (e.key === "Tab" || e.key === "Escape" || e.key === "Enter" || e.key === " ") lastInput = "key"; }, true);
}

export function Dialog({ open, title, onClose, children, tone = "paper", wide = false }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; tone?: "paper" | "decision"; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const id = useId();
  const close = useT().common.close;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      // Back to the opener; show the focus ring only if the player is using the keyboard.
      (opener.current as HTMLElement | null)?.focus?.({ focusVisible: lastInput === "key", preventScroll: true } as FocusOptions);
    }
  }, [open]);
  return (
    <dialog ref={ref} className={`dlg dlg--${tone}${wide ? " dlg--wide" : ""}`} aria-labelledby={id} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <header className="dlg__head">
        <h2 id={id}>{title}</h2>
        <button type="button" className="dlg__close" onClick={onClose} aria-label={close}>×</button>
      </header>
      <div className="dlg__body">{children}</div>
    </dialog>
  );
}
