"use client";
import { useContext, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { type Group, NeutralToneMapping, type PerspectiveCamera, Spherical, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MannequinSceneProps, SceneView } from "@/lib/provador/contract";
import { MannequinEngine, type EngineInput } from "./engine/engine";
import { Stage } from "./Stage";
import { type RimUniforms, createRimUniforms } from "./engine/materials";
import { useReducedMotion } from "./useReducedMotion";
import { type SceneDebug, SceneDebugContext } from "./debug";

const FOV = 28;
/** Topo de referência do enquadramento (m): ~1,90 m de corpo + cabelo. */
const FRAME_REF_TOP = 1.98;
/**
 * Giro automático: a mesma velocidade que o OrbitControls (autoRotateSpeed 0,9) tinha numa tela de 60 Hz,
 * agora medida em tempo — o autoRotate do OrbitControls anda por QUADRO (4× mais rápido numa tela de 240 Hz).
 */
const AUTO_ROTATE_RAD_S = ((2 * Math.PI) / 60) * 0.9;
/** Teto de quadros do giro automático: um giro lento não precisa dos 120/144/240 Hz da tela. */
const AUTO_ROTATE_FRAME_MS = 1000 / 60;
/** Sem evento de scroll por esse tempo = página parada. */
const SCROLL_IDLE_MS = 180;
const UP = new Vector3(0, 1, 0);

/** Teto de densidade de pixels: 1,5 (alta) / 1,25 (baixa); aparelho fraco ou economia de dados um degrau abaixo. */
function maxDpr(alta: boolean): number {
  const nav = (typeof navigator === "undefined" ? {} : navigator) as Partial<Navigator> & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const weak = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || nav.connection?.saveData === true;
  if (alta) return weak ? 1.25 : 1.5;
  return weak ? 1 : 1.25;
}

/** Manequim procedural: cria o motor no efeito (seguro no StrictMode) e o anima sob demanda. */
function Mannequin({
  input,
  rim,
  engineRef,
  spinSignal,
  reduced,
  onReady,
}: {
  input: EngineInput;
  rim: RimUniforms;
  engineRef: React.RefObject<MannequinEngine | null>;
  spinSignal?: number;
  reduced: boolean;
  onReady?: () => void;
}) {
  const group = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const latest = useRef(input);
  const ready = useRef(false);
  const readyCb = useRef(onReady);
  const spin = useRef({ start: -1, last: spinSignal ?? 0 });

  useEffect(() => {
    latest.current = input;
    readyCb.current = onReady;
  });

  useEffect(() => {
    const e = new MannequinEngine(rim);
    engineRef.current = e;
    group.current?.add(e.root);
    e.setTarget(latest.current);
    invalidate();
    return () => {
      e.dispose();
      if (engineRef.current === e) engineRef.current = null;
    };
  }, [engineRef, invalidate, rim]);

  useEffect(() => {
    engineRef.current?.setTarget(input);
    invalidate();
  }, [input, engineRef, invalidate]);

  useEffect(() => {
    const s = spinSignal ?? 0;
    if (s !== spin.current.last) {
      spin.current.last = s;
      if (!reduced) {
        spin.current.start = -2; // começa no próximo quadro
        invalidate();
      }
    }
  }, [spinSignal, reduced, invalidate]);

  useFrame((state, dt) => {
    const e = engineRef.current;
    const g = group.current;
    if (!e || !g) return;
    let animating = e.update(dt);
    const sp = spin.current;
    if (sp.start === -2) sp.start = state.clock.elapsedTime;
    if (sp.start >= 0) {
      const u = Math.min(1, (state.clock.elapsedTime - sp.start) / 1.6);
      const k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      g.rotation.y = k * Math.PI * 2;
      if (u >= 1) {
        g.rotation.y = 0;
        sp.start = -1;
      } else animating = true;
    }
    if (animating) state.invalidate();
    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(() => readyCb.current?.());
    }
  });

  return <group ref={group} />;
}

const tmp = new Vector3();
const sph = new Spherical();

/** Câmera que enquadra o corpo inteiro (inclusive em retrato) e respeita o zoom do usuário. */
function CameraRig({ engineRef, view, debug }: { engineRef: React.RefObject<MannequinEngine | null>; view: SceneView; debug: SceneDebug | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const st = useRef({ base: 0, init: false, az: null as number | null, user: false });

  useEffect(() => {
    if (view === "frente") st.current.az = 0;
    else if (view === "costas") st.current.az = Math.PI;
    invalidate();
  }, [view, invalidate]);

  // O OrbitControls põe touch-action: none no alvo: um dedo que começa a rolagem em cima do manequim
  // prendia a página (no celular o palco ocupa quase a largura toda). pan-y (padrão do <model-viewer>):
  // arrastar na horizontal gira, na vertical rola a página; pinça segue com o zoom. Em tela cheia nativa, none.
  // (o alvo muda quando o R3F conecta os eventos: o efeito do OrbitControls, filho, roda antes deste)
  const connected = useThree((s) => s.events.connected) as unknown;
  useEffect(() => {
    const el = controls.current?.domElement;
    if (!el) return;
    const apply = () => {
      el.style.touchAction = document.fullscreenElement?.contains(el) ? "none" : "pan-y";
    };
    apply();
    document.addEventListener("fullscreenchange", apply);
    // A roda do mouse rola a PÁGINA; zoom só com Ctrl/⌘ (a pinça do trackpad já chega com ctrlKey).
    // Ouvinte em captura no pai: decide antes do handler de wheel do OrbitControls no próprio alvo.
    const host = el.parentElement;
    const onWheel = (e: WheelEvent) => {
      const c = controls.current;
      if (c) c.enableZoom = e.ctrlKey || e.metaKey || !!document.fullscreenElement?.contains(el);
    };
    host?.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => {
      document.removeEventListener("fullscreenchange", apply);
      host?.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [connected]);

  useFrame((_, dt) => {
    const c = controls.current;
    const e = engineRef.current;
    if (!c || !e) return;
    // Enquadra por uma altura de referência fixa (só cresce para figuras maiores):
    // assim mudar a altura no slider aparece na tela em vez de ser compensado pelo zoom.
    const top = Math.max(e.figureTop / 100, FRAME_REF_TOP);
    const width = e.figureWidth / 100;
    const aspect = Math.max(0.3, size.width / Math.max(1, size.height));
    const tan = Math.tan((FOV * Math.PI) / 360);
    const halfH = top * 0.5 + top * 0.06;
    const halfW = width / 2 + 0.06;
    const base = Math.max(halfH / tan, halfW / (tan * aspect));
    const ty = debug?.focus !== undefined ? top * debug.focus : top * 0.5 - top * 0.01;
    const s = st.current;
    if (debug) {
      // enquadramento fixo para capturas do laboratório
      c.target.set(0, ty, 0);
      sph.set(base * (debug.zoom ?? 1), Math.PI / 2 - (debug.el ?? 0.05), debug.az ?? 0);
      tmp.setFromSpherical(sph);
      camera.position.copy(c.target).add(tmp);
      c.update();
      s.init = true;
      s.base = base;
      return;
    }
    if (!s.init) {
      s.init = true;
      s.base = base;
      c.target.set(0, ty, 0);
      const az = view === "costas" ? Math.PI : 0;
      sph.set(base, Math.PI / 2 - 0.05, az);
      tmp.setFromSpherical(sph);
      camera.position.copy(c.target).add(tmp);
      c.update();
      invalidate();
    } else if (Math.abs(base - s.base) > 0.001 || Math.abs(ty - c.target.y) > 0.001) {
      const k = 1 - Math.exp(-8 * Math.min(dt, 0.1));
      tmp.copy(camera.position).sub(c.target);
      const ratio = tmp.length() / s.base;
      const nb = s.base + (base - s.base) * k;
      c.target.y += (ty - c.target.y) * k;
      tmp.setLength(nb * ratio);
      camera.position.copy(c.target).add(tmp);
      s.base = nb;
      c.update();
      invalidate();
    }
    c.minDistance = s.base * 0.3;
    c.maxDistance = s.base * 1.45;
    if (s.az !== null) {
      const cur = c.getAzimuthalAngle();
      let d = s.az - cur;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.003) s.az = null;
      else {
        c.setAzimuthalAngle(cur + d * (1 - Math.exp(-7 * Math.min(dt, 0.1))));
        c.update();
        invalidate();
      }
    }
  });

  // autoRotate fica fora do OrbitControls: quem gira é o AutoRotate abaixo (por tempo, com teto e pausas).
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.7}
      zoomSpeed={0.7}
      minPolarAngle={0.35}
      maxPolarAngle={1.64}
      onStart={() => {
        st.current.az = null;
      }}
    />
  );
}

/**
 * Giro automático com orçamento: o canvas é sempre frameloop="demand" e este laço só pede um quadro
 * a cada ~16,7 ms (teto de 60 quadros/s em qualquer tela), e só com o canvas na viewport, a aba visível
 * e a página parada. Rolando, fora da tela ou com a aba oculta, nada pede quadros: o canvas fica com a
 * última imagem e a main thread fica livre para a rolagem.
 */
function AutoRotate({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;

  useEffect(() => {
    if (!enabled || !controls) return;
    const canvas = gl.domElement;
    const offset = new Vector3();
    let visible = false;
    let scrolling = false;
    let dragging = false;
    let raf = 0;
    let last = 0;
    let scrollTimer = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const elapsed = now - last;
      if (elapsed < AUTO_ROTATE_FRAME_MS - 2) return;
      last = now;
      if (dragging) return; // como o autoRotate original: não gira enquanto a pessoa arrasta
      offset.copy(camera.position).sub(controls.target).applyAxisAngle(UP, -AUTO_ROTATE_RAD_S * Math.min(elapsed, 100) / 1000);
      camera.position.copy(controls.target).add(offset);
      // sincroniza o estado interno do OrbitControls; o "change" vira UM invalidate() (fora do useFrame)
      controls.update();
    };
    const sync = () => {
      const run = visible && !scrolling && document.visibilityState === "visible";
      if (run && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(canvas);
    const onScroll = () => {
      if (!scrolling) {
        scrolling = true;
        sync();
      }
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        scrolling = false;
        sync();
      }, SCROLL_IDLE_MS);
    };
    const onStart = () => {
      dragging = true;
    };
    const onEnd = () => {
      dragging = false;
    };
    // captura: também pausa ao rolar listas/painéis internos (o evento scroll não borbulha)
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("visibilitychange", sync);
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(scrollTimer);
      io.disconnect();
      document.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("visibilitychange", sync);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
    };
  }, [enabled, controls, camera, gl]);

  return null;
}

function Effects({ theme }: { theme: string }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={theme === "y2k" ? 0.32 : 0.14} luminanceThreshold={0.9} luminanceSmoothing={0.15} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}

export default function MannequinScene(props: MannequinSceneProps) {
  const { bodyParams, appearance, outfit, autoRotate, view, spinSignal, theme = "y2k", quality = "alta", ariaLabel, className, onReady } = props;
  const reduced = useReducedMotion();
  const debug = useContext(SceneDebugContext);
  const engineRef = useRef<MannequinEngine | null>(null);
  const rim = useMemo(() => createRimUniforms(), []);
  // Entrada estável por VALOR: a interface costuma passar objetos novos a cada render (ex.: bodyParams={{...}})
  // e cada identidade nova virava setTarget() → reconstrução completa da malha + um quadro, mesmo sem mudança
  // (no /provador isso acontecia durante a rolagem, a cada re-render da sala).
  const inputKey = JSON.stringify({ bodyParams, appearance, outfit });
  const input = useMemo<EngineInput>(() => JSON.parse(inputKey) as EngineInput, [inputKey]);
  const rotating = autoRotate && !reduced;
  const alta = quality === "alta";
  const dpr = useMemo<[number, number]>(() => [1, maxDpr(alta)], [alta]);

  return (
    <div role="img" aria-label={ariaLabel} className={className} style={{ position: /(^|\s)(absolute|fixed|sticky)(\s|$)/.test(className ?? "") ? undefined : "relative", width: "100%", height: "100%", minHeight: 240 }}>
      <Canvas
        aria-hidden
        frameloop="demand"
        // Sem medir na rolagem: com scroll: true (padrão) o R3F re-renderiza a árvore inteira da cena e
        // desenha um quadro a cada rolagem só porque o canvas mudou de lugar na página (os eventos de
        // ponteiro usam offsetX/offsetY, não precisam do top/left).
        resize={{ scroll: false }}
        dpr={dpr}
        shadows={alta ? "percentage" : false}
        // "high-performance" acorda a GPU dedicada (e, em notebooks com duas GPUs, troca de GPU no meio da rolagem):
        // só o provador em qualidade alta pede isso.
        gl={{ antialias: !alta, alpha: true, powerPreference: alta ? "high-performance" : "default" }}
        camera={{ fov: FOV, near: 0.05, far: 60, position: [0, 1, 6] }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
          gl.setClearColor(0x000000, 0);
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Stage theme={theme} quality={quality} reduced={reduced} rim={rim} />
        <Mannequin input={input} rim={rim} engineRef={engineRef} spinSignal={spinSignal} reduced={reduced} onReady={onReady} />
        <CameraRig engineRef={engineRef} view={view} debug={debug} />
        <AutoRotate enabled={rotating && !debug} />
        {alta && <Effects theme={theme} />}
      </Canvas>
    </div>
  );
}
