// The telemetry bay floor: a blueprint grid on one shader quad (a vanilla port
// of drei's <Grid>, MIT), coordinate labels batched into ONE InstancedMesh over
// a canvas glyph atlas, and a soft blob-shadow quad. Three draw calls total —
// the labels are the part that would explode into a call per sprite otherwise.
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three';

const ACCENT = 0xb497cf;

// drei Grid fragment logic, reduced to what the bay uses: fixed quad, cell +
// section lines with fwidth AA, radial distance fade from the origin.
const GRID_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GRID_FRAGMENT = /* glsl */ `
  varying vec3 vWorld;
  uniform float uCell;
  uniform float uSection;
  uniform vec3 uCellColor;
  uniform vec3 uSectionColor;
  uniform float uFadeRadius;

  float gridLine(float size, float thickness) {
    vec2 r = vWorld.xz / size;
    vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
    float line = min(grid.x, grid.y) + 1.0 - thickness;
    return 1.0 - min(line, 1.0);
  }

  void main() {
    float cell = gridLine(uCell, 1.0);
    float section = gridLine(uSection, 1.0);
    float fade = 1.0 - min(length(vWorld.xz) / uFadeRadius, 1.0);
    vec3 color = mix(uCellColor, uSectionColor, min(1.0, section));
    float alpha = max(cell * 0.35, section * 0.9) * fade * fade;
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

function makeGridQuad(): Mesh {
  const material = new ShaderMaterial({
    vertexShader: GRID_VERTEX,
    fragmentShader: GRID_FRAGMENT,
    uniforms: {
      uCell: { value: 0.1 },
      uSection: { value: 0.5 },
      uCellColor: { value: new Color(ACCENT).multiplyScalar(0.45) },
      uSectionColor: { value: new Color(ACCENT) },
      uFadeRadius: { value: 6.0 },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const quad = new Mesh(new PlaneGeometry(16, 16), material);
  quad.rotation.x = -Math.PI / 2;
  quad.renderOrder = -2;
  return quad;
}

// One texture with every glyph the labels need; instances pick a column via a
// per-instance attribute, so every glyph on the floor is the same draw call.
const CHARSET = '0123456789.xzm';
const GLYPH_PX = 128;

function makeAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = GLYPH_PX * CHARSET.length;
  canvas.height = GLYPH_PX;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#b497cf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `96px "JetBrains Mono Variable", ui-monospace, monospace`;
    for (let i = 0; i < CHARSET.length; i += 1) {
      ctx.fillText(CHARSET[i], i * GLYPH_PX + GLYPH_PX / 2, GLYPH_PX / 2 + 4);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Mipmaps, not the flat LinearFilter this had: a floor label is minified hard
  // by its own perspective, and unfiltered minification is what turned the digits
  // into shimmer. anisotropy is what keeps them legible at the grazing boot angle.
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  return texture;
}

interface Glyph {
  char: string;
  x: number;
  z: number;
}

// The label quad is deliberately NOT square. It lies flat on the floor and the
// boot camera sits barely half a metre above it, so the depth axis — the one the
// glyph's height runs along — is compressed roughly six-fold by perspective; at
// the old square 0.06 the digits landed on screen 1-2 px tall. GLYPH_D stretches
// the height in world space by about that factor so the digits read square again
// at the framing everyone actually sees.
// ponytail: a fixed stretch, not a per-frame billboard fit — orbiting to a
// top-down angle shows the letters elongated. Upgrade path if that ever matters:
// re-scale the instance matrices from the camera pitch in the frame loop.
export const GLYPH_W = 0.085; // advance and quad width, world units
export const GLYPH_D = 0.19; // quad depth (the glyph's apparent height)

// Coordinate readouts every section along both axes, plus the axis letters —
// the "incremental numbers" of the founder screenshot, laid flat on the floor.
// Exported for the layout test: the quads got five times taller and the spacing
// is the only thing keeping them off each other and off the axis lines.
export function layoutGlyphs(): Glyph[] {
  const glyphs: Glyph[] = [];
  const push = (text: string, x: number, z: number) => {
    const width = text.length * GLYPH_W;
    for (let i = 0; i < text.length; i += 1) {
      glyphs.push({ char: text[i], x: x + i * GLYPH_W - width / 2, z });
    }
  };
  // Clear of the axis line by more than half a glyph depth, else the taller quads
  // straddle the very line they annotate.
  const OFF = GLYPH_D / 2 + 0.06;
  for (let step = 1; step <= 4; step += 1) {
    const at = step * 0.5;
    const label = at.toFixed(1) + 'm';
    push(label, at, OFF); // along X, tucked beside the axis line
    push(label, OFF + (label.length * GLYPH_W) / 2, -at);
  }
  push('x', 2.4, OFF);
  push('z', OFF + GLYPH_W / 2, -2.4);
  return glyphs;
}

function makeLabels(): InstancedMesh {
  const glyphs = layoutGlyphs();
  const geometry = new PlaneGeometry(GLYPH_W, GLYPH_D);
  const material = new MeshBasicMaterial({
    map: makeAtlas(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.85,
  });
  // Per-instance atlas column, applied as a UV shift in one injected line.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aGlyph;\nuniform float uColumns;',
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>\nvMapUv.x = (vMapUv.x + aGlyph) / uColumns;`,
      );
    shader.uniforms.uColumns = { value: CHARSET.length };
  };
  const mesh = new InstancedMesh(geometry, material, glyphs.length);
  const columns = new Float32Array(glyphs.length);
  const matrix = new Matrix4();
  glyphs.forEach((glyph, i) => {
    columns[i] = CHARSET.indexOf(glyph.char);
    matrix.makeRotationX(-Math.PI / 2);
    matrix.setPosition(glyph.x, 0.001, glyph.z);
    mesh.setMatrixAt(i, matrix);
  });
  geometry.setAttribute('aGlyph', new InstancedBufferAttribute(columns, 1));
  mesh.renderOrder = -1;
  return mesh;
}

// InPlace clips keep the character at the origin, so a static soft blob is a
// correct contact shadow even mid-Walk; a real shadow map is the upgrade path.
function makeBlobShadow(): Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.25)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new CanvasTexture(canvas);
  const mesh = new Mesh(
    new PlaneGeometry(0.9, 0.9),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.0005;
  mesh.renderOrder = -1;
  return mesh;
}

/** The whole floor: grid quad + one batched label mesh + blob shadow. */
export function createFloor(): Group {
  const group = new Group();
  group.add(makeGridQuad(), makeLabels(), makeBlobShadow());
  return group;
}
