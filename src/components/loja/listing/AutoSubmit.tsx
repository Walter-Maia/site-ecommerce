"use client";

import { useEffect, useRef } from "react";

/**
 * Melhoria progressiva: com JS, o form de filtros envia a cada mudança
 * (next/form faz navegação no cliente). Sem JS, vale o botão "Aplicar".
 */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    form.setAttribute("data-autosubmit", "");
    const onChange = () => form.requestSubmit();
    // URLs limpas: descarta campos vazios ("Todas", "Qualquer preço").
    const onData = (e: FormDataEvent) => {
      for (const [k, v] of [...e.formData.entries()]) if (v === "") e.formData.delete(k);
    };
    form.addEventListener("change", onChange);
    form.addEventListener("formdata", onData);
    return () => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("formdata", onData);
      form.removeAttribute("data-autosubmit");
    };
  }, []);
  return <span ref={ref} hidden />;
}
