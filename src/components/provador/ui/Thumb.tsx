"use client";
import Image from "next/image";
import { useState, type ReactNode } from "react";

/** Imagem com fallback estilizado (arquivo ausente ou erro de carga). */
export function Thumb({ src, alt, sizes, fallback }: { src: string | null; alt: string; sizes: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return <Image src={src} alt={alt} fill sizes={sizes} style={{ objectFit: "cover" }} onError={() => setFailed(true)} />;
}
