"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, type DirectionalLight, DoubleSide, type Group,
  Matrix4, Mesh, PlaneGeometry, type Points, ShaderMaterial, SRGBColorSpace,
} from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import type { SceneTheme } from "@/lib/provador/contract";
import { type RimUniforms, applyRimTheme } from "./engine/materials";

/* ───────────────────────── Piso (grade Y2K / estúdio) ───────────────────────── */

const FLOOR_VERT = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  varying vec2 vXZ;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = textureMatrix * vec4(position, 1.0);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vXZ = wp.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const FLOOR_FRAG = /* glsl */ `
  uniform vec3 color;
  uniform sampler2D tDiffuse;
  uniform vec3 uGrid;
  uniform vec3 uGlow;
  uniform float uRadius;
  uniform float uReflect;
  uniform float uGridOn;
  uniform float uBase;
  varying vec4 vUv;
  varying vec2 vXZ;
  #include <logdepthbuf_pars_fragment>
  float gridLine(vec2 p, float spacing, float width) {
    vec2 q = p / spacing;
    vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(1e-4));
    return 1.0 - min(min(g.x, g.y) / width, 1.0);
  }
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(vXZ);
    float fade = 1.0 - smoothstep(uRadius * 0.2, uRadius, d);
    float g = (gridLine(vXZ, 0.5, 1.15) * 0.75 + gridLine(vXZ, 2.0, 1.6) * 0.45) * uGridOn;
    float pool = exp(-d * d / 0.55);
    vec3 col = uGrid * g * fade + uGlow * pool * 0.55;
    float a = max(g * fade * 0.9, pool * 0.4 * length(uGlow));
    // base opaca (estúdio), dissolvendo no ciclorama ao fundo
    col = mix(col, color, uBase);
    a = mix(a, 1.0 - smoothstep(1.4, 3.0, d), uBase);
    #ifdef USE_REFLECT
      vec4 r = texture2DProj(tDiffuse, vUv);
      float rf = uReflect * (1.0 - smoothstep(0.0, 2.4, d));
      col += r.rgb * rf;
      a = max(a, r.a * rf);
    #endif
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function floorShader(reflect: boolean) {
  return {
    name: "QuadraFloor",
    uniforms: {
      color: { value: new Color() },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      uGrid: { value: new Color("#4fe5ff") },
      uGlow: { value: new Color("#7fe8ff") },
      uRadius: { value: 7 },
      uReflect: { value: 0.32 },
      uGridOn: { value: 1 },
      uBase: { value: 0 },
    },
    vertexShader: (reflect ? "#define USE_REFLECT\n" : "") + FLOOR_VERT,
    fragmentShader: (reflect ? "#define USE_REFLECT\n" : "") + FLOOR_FRAG,
  };
}

/** Configura o material do piso por tema (função pura sobre um material novo). */
function configureFloor(mat: ShaderMaterial, theme: SceneTheme) {
  mat.transparent = true;
  mat.depthWrite = theme !== "y2k";
  const u = mat.uniforms;
  if (theme === "y2k") {
    u.uGridOn.value = 1;
    u.uBase.value = 0;
    u.uGrid.value.set("#4fe5ff");
    u.uGlow.value.set("#8ff0ff");
    u.uReflect.value = 0.34;
    u.uRadius.value = 7.5;
  } else {
    u.uGridOn.value = 0;
    u.uBase.value = 1;
    (u.color.value as Color).set(theme === "boutique" ? "#e7ddcd" : "#e9e6e0");
    u.uGlow.value.set("#000000");
    u.uReflect.value = theme === "boutique" ? 0.2 : 0.1;
  }
}

function createFloor(theme: SceneTheme, reflect: boolean) {
  const geo = new PlaneGeometry(16, 16, 1, 1);
  if (reflect) {
    const r = new Reflector(geo, { textureWidth: 512, textureHeight: 512, clipBias: 0.002, multisample: 0, shader: floorShader(true) });
    configureFloor(r.material as ShaderMaterial, theme);
    return r;
  }
  const m = new ShaderMaterial(floorShader(false));
  m.uniforms.textureMatrix.value = new Matrix4();
  configureFloor(m, theme);
  return new Mesh(geo, m);
}

function Floor({ theme, reflect }: { theme: SceneTheme; reflect: boolean }) {
  const mesh = useMemo(() => createFloor(theme, reflect), [theme, reflect]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      if (mesh instanceof Reflector) mesh.dispose();
      else (mesh.material as ShaderMaterial).dispose();
    },
    [mesh],
  );
  return <primitive object={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} renderOrder={-1} />;
}

/* ───────────────────────── Sombra de contato (blob) ───────────────────────── */

function blobTexture(dark: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, dark);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function Blob({ theme }: { theme: SceneTheme }) {
  const tex = useMemo(() => blobTexture(theme === "y2k" ? "rgba(2,22,36,0.75)" : "rgba(40,30,20,0.5)"), [theme]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} renderOrder={0}>
      <planeGeometry args={[1.1, 0.75]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/* ───────────────────────── Horizonte e partículas (Y2K) ───────────────────────── */

const HORIZON_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  void main() {
    float y = vUv.y;
    float band = exp(-pow((y - 0.42) * 9.0, 2.0));
    float x = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.5);
    gl_FragColor = vec4(uColor * band * x * 0.55, band * x * 0.55);
  }
`;

function Horizon() {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color("#bff6ff") } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: HORIZON_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh position={[0, 0.35, -7.5]} material={mat}>
      <planeGeometry args={[26, 5]} />
    </mesh>
  );
}

function sparkleTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(200,250,255,0.6)");
  g.addColorStop(1, "rgba(200,250,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(31, 4, 2, 56);
  ctx.fillRect(4, 31, 56, 2);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function Sparkles({ count = 36 }: { count?: number }) {
  const ref = useRef<Points>(null);
  const { geo, tex, base } = useMemo(() => {
    const g = new BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + i * 1.7;
      const r = 1.2 + ((i * 37) % 23) / 6;
      p[i * 3] = Math.cos(a) * r;
      p[i * 3 + 1] = 0.2 + ((i * 53) % 29) / 10;
      p[i * 3 + 2] = Math.sin(a) * r - 1.2;
    }
    g.setAttribute("position", new BufferAttribute(p, 3));
    return { geo: g, tex: sparkleTexture(), base: p.slice() };
  }, [count]);
  useEffect(
    () => () => {
      geo.dispose();
      tex.dispose();
    },
    [geo, tex],
  );
  // tempo próprio, acumulado só nos quadros desenhados (frameloop "demand"): ao voltar de uma pausa
  // (rolagem, fora da tela) as partículas continuam de onde pararam em vez de saltar
  const time = useRef(0);
  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const t = (time.current += Math.min(dt, 0.05));
    const pos = pts.geometry.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < count; i++) pos.setY(i, base[i * 3 + 1] + ((t * 0.05 + i * 0.37) % 1) * 0.4);
    pos.needsUpdate = true;
    const m = pts.material as unknown as { opacity: number };
    m.opacity = 0.55 + 0.25 * Math.sin(t * 1.3);
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={tex} size={0.07} sizeAttenuation transparent depthWrite={false} blending={AdditiveBlending} opacity={0.7} toneMapped={false} />
    </points>
  );
}

/* ───────────────────────── Estúdio creme (boutique) ───────────────────────── */

function Cyclorama() {
  const geo = useMemo(() => {
    // piso → curva → parede, em uma só folha
    const w = 14, R = 1.6, segs = 10, wall = 6;
    const prof: [number, number][] = [[0, 2]];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * (Math.PI / 2);
      prof.push([R - Math.cos(a) * R, -2.6 - Math.sin(a) * R]);
    }
    prof.push([wall, -2.6 - R]);
    const pos: number[] = [];
    const idx: number[] = [];
    prof.forEach(([y, z], i) => {
      pos.push(-w / 2, y, z, w / 2, y, z);
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} receiveShadow position={[0, -0.001, 0]}>
      <meshStandardMaterial color="#efe6d8" roughness={0.95} side={DoubleSide} />
    </mesh>
  );
}

/* ───────────────────────── Luzes por tema ───────────────────────── */

function Lights({ theme, shadows, rim }: { theme: SceneTheme; shadows: boolean; rim: RimUniforms }) {
  const key = useRef<DirectionalLight>(null);
  const rig = useRef<Group>(null);
  // o "estúdio" de luz acompanha o azimute da câmera: o rim fica sempre nas bordas da silhueta
  useFrame(({ camera }) => {
    if (rig.current) rig.current.rotation.y = Math.atan2(camera.position.x, camera.position.z);
  });
  useEffect(() => applyRimTheme(rim, theme), [theme, rim]);
  const y2k = theme === "y2k";
  return (
    <>
      <hemisphereLight args={[y2k ? "#d8f6ff" : "#fff6ea", y2k ? "#0a4a6b" : "#cdbfac", y2k ? 0.7 : 0.85]} />
      <group ref={rig}>
      <directionalLight
        ref={key}
        position={[2.2, 4.2, 3.4]}
        intensity={y2k ? 2.1 : 2.3}
        color={y2k ? "#fffaf2" : "#fff1de"}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-1.3}
        shadow-camera-right={1.3}
        shadow-camera-top={2.4}
        shadow-camera-bottom={-0.4}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-3, 2.2, 2.4]} intensity={y2k ? 0.55 : 0.8} color={y2k ? "#cfe9ff" : "#fff8ef"} />
      {y2k ? (
        <>
          <directionalLight position={[-3.2, 2.4, -2.6]} intensity={1.35} color="#4fe5ff" />
          <directionalLight position={[3.2, 2.4, -2.6]} intensity={1.35} color="#ff3d8e" />
        </>
      ) : (
        <directionalLight position={[0, 3, -3.5]} intensity={theme === "boutique" ? 1.3 : 0.9} color="#ffffff" />
      )}
      </group>
    </>
  );
}

function ShadowCatcher({ opacity }: { opacity: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow renderOrder={0}>
      <planeGeometry args={[6, 6]} />
      <shadowMaterial transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function Background({ theme }: { theme: SceneTheme }) {
  if (theme === "y2k") return null;
  return <color attach="background" args={[theme === "boutique" ? "#efe6d8" : "#f1efea"]} />;
}

export function Stage({ theme, quality, reduced, rim }: { theme: SceneTheme; quality: "alta" | "baixa"; reduced: boolean; rim: RimUniforms }) {
  const alta = quality === "alta";
  return (
    <>
      <Background theme={theme} />
      <Lights theme={theme} shadows={alta} rim={rim} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[6, 2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.2} position={[-4, 1.5, 1]} rotation={[0, Math.PI / 2, 0]} scale={[3, 3, 1]} color={theme === "y2k" ? "#4fe5ff" : "#fff3e6"} />
        <Lightformer form="rect" intensity={1.2} position={[4, 1.5, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[3, 3, 1]} color={theme === "y2k" ? "#ff3d8e" : "#fff3e6"} />
        <Lightformer form="rect" intensity={0.6} position={[0, -2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 8, 1]} color={theme === "y2k" ? "#0a4a6b" : "#d9ccb8"} />
      </Environment>
      {theme === "boutique" && <Cyclorama />}
      {theme !== "neutral" && <Floor theme={theme} reflect={alta} />}
      <Blob theme={theme} />
      {alta && <ShadowCatcher opacity={theme === "y2k" ? 0.32 : 0.22} />}
      {theme === "y2k" && <Horizon />}
      {theme === "y2k" && !reduced && <Sparkles count={alta ? 36 : 18} />}
    </>
  );
}
