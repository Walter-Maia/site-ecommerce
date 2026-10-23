"use client";
import { useMemo, useState, type RefObject } from "react";
import type { BodyParams, SceneTheme } from "@/lib/provador/contract";
import LazyMannequinScene from "./scene/LazyMannequinScene";
import { useFitting } from "./context";
import { Icon, type IconName } from "./ui/icons";

/**
 * Palco: o manequim ocupa tudo. Por cima, só o seletor de manequim (topo) e
 * a barra de câmera (base). É também o elemento que vai para tela cheia.
 */
export function StageView({
  stageRef,
  bodyParams,
  autoRotate,
}: {
  stageRef: RefObject<HTMLElement | null>;
  bodyParams: BodyParams;
  autoRotate: boolean;
}) {
  const f = useFitting();
  const { state, preset, worn } = f;
  const theme: SceneTheme = state.appearance.style === "formal" ? "boutique" : "y2k";

  const ariaLabel = useMemo(() => {
    const list = worn.map((w) => `${w.product.name} (${w.size})`);
    return `Manequim ${preset.name}, ${state.heightCm} cm e ${state.weightKg} kg, ${list.length ? `vestindo ${list.join(", ")}` : "sem roupas do catálogo"}.`;
  }, [worn, preset.name, state.heightCm, state.weightKg]);

  const fs = f.fullscreen;
  return (
    <section
      ref={stageRef}
      className="pv-stage"
      aria-labelledby="pv-titulo"
      aria-describedby="pv-atalhos"
      data-fullscreen={fs !== "off" || undefined}
      data-pseudo-fs={fs === "pseudo" || undefined}
    >
      <div className="pv-canvas">
        <LazyMannequinScene
          bodyParams={bodyParams}
          appearance={state.appearance}
          outfit={f.sceneOutfit}
          autoRotate={autoRotate}
          view={state.view}
          spinSignal={state.spin}
          theme={theme}
          quality={f.mobile ? "baixa" : "alta"}
          ariaLabel={ariaLabel}
          className="size-full"
        />
      </div>
      <div className="pv-stage__floor" aria-hidden="true" />
      <MannequinPicker />
      <ViewBar />
      {f.toast ? (
        <p key={f.toast.id} className="pv-toast" aria-hidden="true">
          {f.toast.msg}
        </p>
      ) : null}
      <p id="pv-atalhos" className="sr-only">
        Atalhos de teclado com o provador na tela: seta para a esquerda e seta para a direita trocam o manequim; R gira o manequim em 360°; Ctrl mais a roda do mouse dá zoom (sem Ctrl, a roda rola a página).
      </p>
    </section>
  );
}

/** Pílulas com os nomes dos manequins (setas quando há muitos). */
function MannequinPicker() {
  const f = useFitting();
  const list = f.data.mannequins;
  if (list.length < 2) return null;
  if (list.length > 4) {
    return (
      <div className="pv-picker" role="group" aria-label="Manequim">
        <button type="button" className="pv-picker__arrow" aria-label="Manequim anterior" aria-keyshortcuts="ArrowLeft" onClick={() => f.stepMannequin(-1)}>
          <Icon name="left" size={18} />
        </button>
        <span className="pv-picker__name" aria-live="polite">
          {f.preset.name}
        </span>
        <button type="button" className="pv-picker__arrow" aria-label="Próximo manequim" aria-keyshortcuts="ArrowRight" onClick={() => f.stepMannequin(1)}>
          <Icon name="right" size={18} />
        </button>
      </div>
    );
  }
  return (
    <div className="pv-picker" role="group" aria-label="Manequim">
      {list.map((m) => (
        <button
          key={m.id}
          type="button"
          className="pv-picker__pill"
          aria-pressed={m.id === f.state.mannequinId}
          aria-keyshortcuts="ArrowLeft ArrowRight"
          onClick={() => f.setMannequin(m.id)}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
}

/** Barra flutuante de câmera: frente/costas, 360°, giro automático, tela cheia e ajuda de atalhos. */
function ViewBar() {
  const f = useFitting();
  const { view, autoRotate } = f.state;
  const fs = f.fullscreen !== "off";
  const [help, setHelp] = useState(false);
  const icons: { key: string; icon: IconName; label: string; pressed?: boolean; keys?: string; run: () => void }[] = [
    { key: "spin", icon: "rotate", label: "Girar 360°", keys: "R", run: f.spin },
    {
      key: "auto",
      icon: autoRotate ? "pause" : "play",
      label: autoRotate ? "Parar giro automático" : "Giro automático",
      pressed: autoRotate,
      run: () => f.dispatch({ type: "autoRotate", value: !autoRotate }),
    },
    { key: "fs", icon: fs ? "collapse" : "expand", label: fs ? "Sair da tela cheia" : "Tela cheia", pressed: fs, run: f.toggleFullscreen },
  ];
  return (
    <div className="pv-viewbar" role="toolbar" aria-label="Câmera">
      <div className="pv-seg" role="group" aria-label="Lado">
        <button type="button" aria-pressed={view === "frente" && !autoRotate} onClick={() => f.dispatch({ type: "view", view: "frente" })}>
          Frente
        </button>
        <button type="button" aria-pressed={view === "costas"} onClick={() => f.dispatch({ type: "view", view: "costas" })}>
          Costas
        </button>
      </div>
      <span className="pv-viewbar__sep" aria-hidden="true" />
      {icons.map((it) => (
        <button
          key={it.key}
          type="button"
          className="pv-iconbtn"
          aria-label={it.label}
          aria-pressed={it.pressed}
          aria-keyshortcuts={it.keys}
          onClick={it.run}
        >
          <Icon name={it.icon} size={19} />
          <span className="pv-tip" aria-hidden="true">
            {it.label}
            {it.keys ? <kbd>{it.keys}</kbd> : null}
          </span>
        </button>
      ))}
      <button
        type="button"
        className="pv-iconbtn"
        aria-label="Atalhos do teclado"
        aria-describedby="pv-atalhos"
        data-open={help || undefined}
        onClick={() => setHelp((v) => !v)}
        onBlur={() => setHelp(false)}
      >
        <Icon name="keyboard" size={19} />
        <span className="pv-tip pv-tip--end" aria-hidden="true">
          <kbd>←</kbd>
          <kbd>→</kbd> manequim · <kbd>R</kbd> girar · <kbd>Ctrl</kbd> + rolar zoom
        </span>
      </button>
    </div>
  );
}
