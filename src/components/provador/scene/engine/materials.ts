import { Color, DoubleSide, FrontSide, MeshStandardMaterial, type Texture } from "three";
import type { FabricPattern } from "@/lib/types";

/**
 * Uniforms compartilhados por todos os materiais do manequim: rim estilizado
 * (ciano à esquerda / magenta à direita no Y2K, como na folha de referência)
 * e um "subsurface" falso na pele.
 */
export interface RimUniforms {
  uRimL: { value: Color };
  uRimR: { value: Color };
  uRimStrength: { value: number };
  uRimPower: { value: number };
}

export function createRimUniforms(): RimUniforms {
  return {
    uRimL: { value: new Color("#4fe5ff") },
    uRimR: { value: new Color("#ff3d8e") },
    uRimStrength: { value: 0.4 },
    uRimPower: { value: 2.6 },
  };
}

/** Cores do rim por tema (ciano/magenta no Y2K; luz quente e discreta no estúdio). */
export function applyRimTheme(rim: RimUniforms, theme: "y2k" | "boutique" | "neutral") {
  const [l, r, k] = theme === "y2k" ? ["#4fe5ff", "#ff3d8e", 0.55] : theme === "boutique" ? ["#fff3e0", "#fff3e0", 0.12] : ["#ffffff", "#ffffff", 0.08];
  rim.uRimL.value.set(l as string);
  rim.uRimR.value.set(r as string);
  rim.uRimStrength.value = k as number;
}

interface PatchOpts {
  /** Ganho do rim neste material (pele > tecido). */
  rim: number;
  /** Cor de "subsurface" somada à luz indireta (pele). */
  sss?: Color;
  /** Escurece faces internas (avesso da roupa). */
  backDarken?: number;
}

function patch(mat: MeshStandardMaterial, rim: RimUniforms, o: PatchOpts) {
  const key = `manequim-${o.rim}-${o.sss ? 1 : 0}-${o.backDarken ?? 0}`;
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRimL = rim.uRimL;
    sh.uniforms.uRimR = rim.uRimR;
    sh.uniforms.uRimStrength = rim.uRimStrength;
    sh.uniforms.uRimPower = rim.uRimPower;
    sh.uniforms.uSSS = { value: o.sss ?? new Color(0, 0, 0) };
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uRimL;\nuniform vec3 uRimR;\nuniform float uRimStrength;\nuniform float uRimPower;\nuniform vec3 uSSS;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n${o.backDarken ? `if (!gl_FrontFacing) diffuseColor.rgb *= ${o.backDarken.toFixed(2)};` : ""}`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        {
          vec3 vdir = normalize(vViewPosition);
          float fr = pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), uRimPower);
          float side = smoothstep(-0.25, 0.25, normal.x);
          vec3 rc = mix(uRimL, uRimR, side);
          reflectedLight.indirectDiffuse += rc * fr * uRimStrength * ${o.rim.toFixed(2)};
          reflectedLight.indirectDiffuse += uSSS * diffuseColor.rgb * (0.35 + 0.65 * fr);
        }`,
      );
  };
}

export function skinMaterial(hex: string, rim: RimUniforms) {
  const m = new MeshStandardMaterial({ color: new Color(hex), roughness: 0.68, metalness: 0, flatShading: true });
  patch(m, rim, { rim: 1.15, sss: new Color("#ff8f73").multiplyScalar(0.08) });
  return m;
}

const ROUGH: Record<FabricPattern, number> = {
  solid: 0.86,
  pinstripe: 0.8,
  mesh: 0.74,
  denim: 0.92,
  rib: 0.88,
  satin: 0.42,
  leather: 0.34,
  heather: 0.92,
  nylon: 0.44,
  plaid: 0.95,
  canvas: 0.9,
  corduroy: 0.82,
};

export function fabricMaterial(pattern: FabricPattern, map: Texture | null, rim: RimUniforms, color = "#ffffff") {
  const m = new MeshStandardMaterial({
    color: new Color(color),
    map,
    roughness: ROUGH[pattern],
    metalness: pattern === "satin" ? 0.06 : pattern === "leather" ? 0.08 : 0,
    flatShading: true,
    side: DoubleSide,
    envMapIntensity: pattern === "satin" ? 0.9 : pattern === "leather" || pattern === "nylon" ? 1.1 : 0.6,
  });
  patch(m, rim, { rim: 0.8, backDarken: 0.5 });
  return m;
}

export function decalMaterial(map: Texture, rim: RimUniforms, roughness = 0.7) {
  const m = new MeshStandardMaterial({
    map,
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    roughness,
    metalness: 0,
    flatShading: true,
    side: FrontSide,
  });
  patch(m, rim, { rim: 0.6 });
  return m;
}

export function hairMaterial(hex: string, rim: RimUniforms) {
  const m = new MeshStandardMaterial({ color: new Color(hex), roughness: 0.52, metalness: 0.05, flatShading: true, side: DoubleSide });
  patch(m, rim, { rim: 0.9, backDarken: 0.6 });
  return m;
}

export function plainMaterial(hex: string, rim: RimUniforms, roughness = 0.6, metalness = 0) {
  const m = new MeshStandardMaterial({ color: new Color(hex), roughness, metalness, flatShading: true, side: DoubleSide });
  patch(m, rim, { rim: 0.7, backDarken: 0.55 });
  return m;
}
