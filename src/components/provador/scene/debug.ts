"use client";
import { createContext } from "react";

/** Só para a página de laboratório: força enquadramento da câmera (close do rosto, perfil, etc.). */
export interface SceneDebug {
  /** Azimute fixo da câmera (rad, 0 = frente). */
  az?: number;
  /** Elevação (rad acima do horizonte). */
  el?: number;
  /** Fator de zoom (1 = corpo inteiro). */
  zoom?: number;
  /** Altura do alvo como fração da figura (0.5 = meio). */
  focus?: number;
}

export const SceneDebugContext = createContext<SceneDebug | null>(null);
