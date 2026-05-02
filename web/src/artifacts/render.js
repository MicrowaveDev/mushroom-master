import { artifactVisualClassification } from '../../../app/shared/artifact-visual-classification.js';

export function artifactTheme(artifact) {
  const themes = {
    damage: {
      shell: '#f5d59d',
      border: '#9d6130',
      accent: '#cc6b2c',
      ink: '#4f2f12',
      glow: 'rgba(255, 183, 112, 0.45)'
    },
    armor: {
      shell: '#d8e5cc',
      border: '#5f7c4f',
      accent: '#86a46d',
      ink: '#21351c',
      glow: 'rgba(148, 188, 138, 0.35)'
    },
    stun: {
      shell: '#dfe3b7',
      border: '#7a6f26',
      accent: '#c2a942',
      ink: '#393214',
      glow: 'rgba(233, 218, 129, 0.4)'
    }
  };
  if (artifact.family === 'bag' && artifact.color) {
    return {
      shell: artifact.color + '33',
      border: artifact.color,
      accent: artifact.color,
      ink: '#2a2a2a',
      glow: artifact.color + '40'
    };
  }
  return themes[artifact.family] || themes.damage;
}

export function renderArtifactGlyph(artifact, theme) {
  switch (artifact.id) {
    case 'spore_needle':
      return `
        <ellipse cx="40" cy="24" rx="14" ry="10" fill="${theme.accent}" opacity="0.92" />
        <path d="M40 32 L46 74" stroke="${theme.ink}" stroke-width="8" stroke-linecap="round" />
        <path d="M32 40 L56 30" stroke="${theme.border}" stroke-width="5" stroke-linecap="round" />
      `;
    case 'sporeblade':
      return `
        <path d="M24 60 L54 16 C58 12 66 18 62 24 L36 66 Z" fill="${theme.accent}" stroke="${theme.ink}" stroke-width="5" stroke-linejoin="round" />
        <path d="M34 50 L56 22" stroke="${theme.shell}" stroke-width="4" stroke-linecap="round" opacity="0.82" />
        <circle cx="28" cy="62" r="7" fill="${theme.border}" />
      `;
    case 'amber_fang':
      return `
        <path d="M42 10 C58 14 60 44 50 78 C46 86 38 86 34 78 C24 48 26 18 42 10 Z" fill="${theme.accent}" />
        <path d="M40 20 C44 32 45 48 42 68" stroke="${theme.shell}" stroke-width="5" stroke-linecap="round" opacity="0.78" />
      `;
    case 'fang_whip':
      return `
        <path d="M18 58 C26 42 42 42 50 28 C54 20 60 16 66 14" stroke="${theme.ink}" stroke-width="7" stroke-linecap="round" fill="none" />
        <path d="M58 14 C70 18 70 34 60 46 C54 38 52 24 58 14 Z" fill="${theme.accent}" stroke="${theme.border}" stroke-width="4" />
        <path d="M26 54 C34 50 42 46 48 38" stroke="${theme.shell}" stroke-width="4" stroke-linecap="round" opacity="0.75" />
      `;
    case 'burning_cap':
      return `
        <path d="M18 44 C22 24 36 18 48 22 C58 24 64 34 66 46 C58 54 42 56 28 52 Z" fill="${theme.accent}" />
        <path d="M30 30 C34 18 44 16 42 30 C48 24 56 28 52 40 C48 50 34 48 30 40 C28 36 28 34 30 30 Z" fill="#f6b14a" opacity="0.88" />
        <path d="M38 48 L38 64" stroke="${theme.ink}" stroke-width="7" stroke-linecap="round" />
      `;
    case 'glass_cap':
      return `
        <path d="M16 44 C22 24 42 14 64 14 C86 14 106 24 112 44 C104 56 84 60 64 60 C42 60 24 56 16 44 Z" fill="${theme.accent}" />
        <path d="M64 42 L64 62" stroke="${theme.ink}" stroke-width="8" stroke-linecap="round" />
        <path d="M34 36 C46 30 80 30 94 36" stroke="${theme.shell}" stroke-width="5" stroke-linecap="round" opacity="0.78" />
      `;
    case 'bark_plate':
      return `
        <rect x="18" y="18" width="44" height="44" rx="14" fill="${theme.accent}" />
        <path d="M30 22 C24 36 24 50 30 64" stroke="${theme.ink}" stroke-width="5" stroke-linecap="round" />
        <path d="M48 22 C54 36 54 50 48 62" stroke="${theme.border}" stroke-width="4" stroke-linecap="round" />
      `;
    case 'loam_scale':
      return `
        <path d="M22 46 C28 26 42 16 58 22 C60 40 50 58 32 64 C24 60 20 54 22 46 Z" fill="${theme.accent}" stroke="${theme.border}" stroke-width="4" />
        <path d="M32 34 C40 38 46 44 50 54" stroke="${theme.ink}" stroke-width="5" stroke-linecap="round" fill="none" />
        <path d="M28 48 C36 50 42 54 46 60" stroke="${theme.shell}" stroke-width="4" stroke-linecap="round" opacity="0.72" />
      `;
    case 'mycelium_wrap':
      return `
        <path d="M12 38 C24 24 42 22 60 32" stroke="${theme.shell}" stroke-width="7" stroke-linecap="round" fill="none" />
        <path d="M68 32 C78 44 92 46 108 34" stroke="${theme.shell}" stroke-width="7" stroke-linecap="round" fill="none" />
        <circle cx="60" cy="38" r="8" fill="${theme.ink}" opacity="0.8" />
      `;
    case 'root_shell':
      return `
        <path d="M20 20 C32 12 48 12 60 20 C68 30 68 50 60 62 C48 72 32 72 20 62 C12 50 12 30 20 20 Z" fill="${theme.accent}" />
        <path d="M38 12 L38 70" stroke="${theme.border}" stroke-width="6" stroke-linecap="round" />
      `;
    case 'stone_cap':
      return `
        <path d="M18 44 C24 26 38 18 54 22 C64 26 70 36 70 48 C58 56 36 58 20 50 Z" fill="${theme.accent}" stroke="${theme.border}" stroke-width="4" />
        <path d="M32 50 L32 64 M48 50 L48 64" stroke="${theme.ink}" stroke-width="6" stroke-linecap="round" />
        <path d="M28 38 L54 34" stroke="${theme.shell}" stroke-width="4" stroke-linecap="round" opacity="0.72" />
      `;
    case 'truffle_bulwark':
      return `
        <path d="M18 34 C24 20 36 16 48 18 C60 20 68 30 66 44 C64 60 50 68 34 64 C20 60 12 48 18 34 Z" fill="${theme.accent}" stroke="${theme.ink}" stroke-width="4" />
        <path d="M28 30 C36 38 42 48 46 60" stroke="${theme.border}" stroke-width="5" stroke-linecap="round" fill="none" />
        <circle cx="52" cy="32" r="5" fill="${theme.shell}" opacity="0.76" />
      `;
    case 'shock_puff':
      return `
        <path d="M22 52 C14 38 24 18 42 20 C50 10 68 12 72 28 C88 28 96 44 88 58 C80 70 60 74 42 70 C32 68 24 62 22 52 Z" fill="${theme.accent}" />
        <path d="M52 24 L42 44 H56 L46 64" stroke="${theme.ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      `;
    case 'glimmer_cap':
      return `
        <path d="M18 44 C24 28 38 20 52 22 C62 24 68 34 70 46 C58 54 36 56 20 50 Z" fill="${theme.accent}" />
        <path d="M40 50 L40 64" stroke="${theme.ink}" stroke-width="7" stroke-linecap="round" />
        <path d="M54 18 L58 26 L66 30 L58 34 L54 42 L50 34 L42 30 L50 26 Z" fill="${theme.shell}" stroke="${theme.border}" stroke-width="3" />
      `;
    case 'dust_veil':
      return `
        <path d="M20 34 C34 20 54 20 66 34 C58 42 48 46 38 46 C30 46 24 42 20 34 Z" fill="${theme.accent}" opacity="0.72" />
        <path d="M24 52 C34 44 48 44 60 52" stroke="${theme.border}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.82" />
        <circle cx="30" cy="32" r="4" fill="${theme.shell}" /><circle cx="52" cy="38" r="3" fill="${theme.shell}" />
      `;
    case 'static_spore_sac':
      return `
        <path d="M42 12 C56 16 60 34 56 56 C52 70 48 78 46 84 C42 88 34 88 30 84 C22 58 24 24 42 12 Z" fill="${theme.accent}" />
        <path d="M40 22 L30 44 H42 L34 68" stroke="${theme.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <circle cx="50" cy="24" r="7" fill="${theme.shell}" opacity="0.88" />
      `;
    case 'thunder_gill':
      return `
        <path d="M14 40 C24 24 42 18 60 18 C80 18 98 24 106 40 C98 52 80 56 60 56 C40 56 22 52 14 40 Z" fill="${theme.accent}" />
        <path d="M42 28 L34 44 H48 L40 58" stroke="${theme.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <path d="M68 28 L62 42 H74 L66 56" stroke="${theme.border}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      `;
    case 'spark_spore':
      return `
        <circle cx="40" cy="40" r="22" fill="${theme.accent}" stroke="${theme.border}" stroke-width="4" />
        <path d="M42 18 L34 38 H46 L38 62" stroke="${theme.ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <circle cx="54" cy="28" r="5" fill="${theme.shell}" opacity="0.86" />
      `;
    case 'moss_ring':
      return `
        <circle cx="40" cy="40" r="22" fill="none" stroke="${theme.accent}" stroke-width="12" />
        <circle cx="40" cy="40" r="13" fill="${theme.glow}" stroke="${theme.border}" stroke-width="4" />
        <path d="M28 34 C34 28 46 28 52 34" stroke="${theme.shell}" stroke-width="4" stroke-linecap="round" fill="none" />
      `;
    case 'haste_wisp':
      return `
        <path d="M24 56 C32 34 44 24 58 18 C52 34 64 42 48 62 C42 54 34 54 24 56 Z" fill="${theme.accent}" stroke="${theme.border}" stroke-width="4" />
        <path d="M30 48 C40 42 48 34 56 22" stroke="${theme.shell}" stroke-width="4" stroke-linecap="round" opacity="0.82" />
        <circle cx="54" cy="20" r="5" fill="${theme.ink}" opacity="0.65" />
      `;
    case 'moss_pouch':
      return `
        <rect x="14" y="14" width="52" height="52" rx="18" fill="${theme.accent}" opacity="0.25" stroke="${theme.border}" stroke-width="3" stroke-dasharray="6 4" />
        <path d="M30 28 C30 20 50 20 50 28 L52 54 C52 60 28 60 28 54 Z" fill="${theme.accent}" opacity="0.5" />
        <path d="M34 22 C34 16 46 16 46 22" stroke="${theme.border}" stroke-width="3" fill="none" stroke-linecap="round" />
        <text x="40" y="50" text-anchor="middle" font-size="18" font-weight="bold" fill="${theme.ink}">${artifact.slotCount || ''}</text>
      `;
    case 'amber_satchel':
      return `
        <rect x="10" y="10" width="60" height="60" rx="14" fill="${theme.accent}" opacity="0.25" stroke="${theme.border}" stroke-width="3" />
        <rect x="18" y="22" width="44" height="36" rx="8" fill="${theme.accent}" opacity="0.4" />
        <path d="M28 22 L28 16 C28 12 52 12 52 16 L52 22" stroke="${theme.border}" stroke-width="3" fill="none" stroke-linecap="round" />
        <rect x="32" y="28" width="16" height="6" rx="3" fill="${theme.border}" opacity="0.6" />
        <text x="40" y="52" text-anchor="middle" font-size="18" font-weight="bold" fill="${theme.ink}">${artifact.slotCount || ''}</text>
      `;
    case 'spore_lash':
      return `
        <path d="M20 58 C24 48 34 42 42 34 C49 28 54 24 58 18" stroke="${theme.ink}" stroke-width="7" stroke-linecap="round" fill="none" />
        <path d="M54 18 L60 12 L62 20 L68 22 L62 26 L60 34 L54 28 L48 30 L50 22 L44 18 Z" stroke="${theme.border}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="${theme.accent}" />
        <circle cx="58" cy="22" r="5" fill="${theme.shell}" />
      `;
    case 'entropy_shard':
      return `
        <path d="M40 12 L62 32 L54 62 L30 68 L18 36 Z" fill="${theme.accent}" stroke="${theme.ink}" stroke-width="4" stroke-linejoin="round" />
        <path d="M28 34 L52 54 M52 30 L32 58" stroke="${theme.border}" stroke-width="5" stroke-linecap="round" opacity="0.86" />
      `;
    case 'thalla_sacred_thread':
      return `
        <path d="M18 54 C28 28 50 60 62 24" stroke="${theme.border}" stroke-width="7" stroke-linecap="round" fill="none" />
        <path d="M20 56 C32 38 48 56 62 26" stroke="${theme.shell}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.9" />
        <circle cx="60" cy="26" r="6" fill="${theme.accent}" />
      `;
    case 'lomie_crystal_lattice':
      return `
        <path d="M24 20 H56 L66 40 L56 60 H24 L14 40 Z" fill="${theme.accent}" stroke="${theme.border}" stroke-width="4" />
        <path d="M24 20 L56 60 M56 20 L24 60 M14 40 H66" stroke="${theme.shell}" stroke-width="4" opacity="0.75" />
      `;
    case 'axilin_ferment_core':
      return `
        <circle cx="40" cy="42" r="22" fill="${theme.accent}" stroke="${theme.ink}" stroke-width="4" />
        <path d="M30 42 C34 32 48 32 52 42 C48 52 34 52 30 42 Z" fill="${theme.shell}" opacity="0.8" />
        <circle cx="48" cy="26" r="5" fill="${theme.border}" />
      `;
    case 'kirt_venom_fang':
      return `
        <path d="M42 12 C58 22 56 50 44 70 C36 60 28 34 42 12 Z" fill="${theme.accent}" stroke="${theme.ink}" stroke-width="4" />
        <path d="M42 24 C46 36 46 50 42 62" stroke="${theme.shell}" stroke-width="4" stroke-linecap="round" opacity="0.78" />
        <circle cx="52" cy="30" r="4" fill="${theme.border}" />
      `;
    case 'morga_flash_seed':
      return `
        <path d="M40 14 C56 24 62 44 50 62 C42 74 26 62 24 46 C22 30 30 20 40 14 Z" fill="${theme.accent}" stroke="${theme.border}" stroke-width="4" />
        <path d="M42 20 L34 42 H46 L38 62" stroke="${theme.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      `;
    case 'dalamar_ashen_shard':
      return `
        <path d="M34 12 L62 34 L48 70 L20 52 Z" fill="${theme.accent}" stroke="${theme.ink}" stroke-width="4" stroke-linejoin="round" />
        <path d="M30 30 C42 34 48 44 50 58" stroke="${theme.border}" stroke-width="5" stroke-linecap="round" fill="none" />
      `;
    case 'settling_guard':
      return `
        <path d="M18 30 C24 20 34 16 40 16 C46 16 56 20 62 30 C60 42 50 52 40 58 C30 52 20 42 18 30 Z" fill="${theme.accent}" />
        <path d="M24 30 C28 24 34 22 40 22 C46 22 52 24 56 30" stroke="${theme.border}" stroke-width="5" stroke-linecap="round" fill="none" />
        <line x1="22" y1="62" x2="58" y2="62" stroke="${theme.ink}" stroke-width="6" stroke-linecap="round" />
      `;
    case 'ferment_phial':
      return `
        <path d="M34 16 H46 M36 16 V28 L28 56 C27 61 31 66 36 66 H44 C49 66 53 61 52 56 L44 28 V16" stroke="${theme.ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="${theme.accent}" />
        <path d="M31 50 C35 48 45 48 49 50" stroke="${theme.shell}" stroke-width="4" stroke-linecap="round" fill="none" />
        <circle cx="44" cy="24" r="5" fill="${theme.shell}" />
      `;
    case 'measured_strike':
      return `
        <path d="M40 14 L48 28 L40 62 L32 28 Z" fill="${theme.accent}" stroke="${theme.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="24" y1="32" x2="56" y2="32" stroke="${theme.border}" stroke-width="6" stroke-linecap="round" />
        <line x1="40" y1="18" x2="40" y2="60" stroke="${theme.shell}" stroke-width="4" stroke-linecap="round" />
      `;
    case 'flash_cap':
      return `
        <path d="M18 42 C22 28 30 20 40 20 C50 20 58 28 62 42 C56 48 48 50 40 50 C32 50 24 48 18 42 Z" fill="${theme.accent}" />
        <path d="M40 50 L40 62 M28 24 L24 18 M40 18 L40 12 M52 24 L56 18 M60 32 L66 28" stroke="${theme.border}" stroke-width="5" stroke-linecap="round" fill="none" />
        <path d="M30 38 C34 36 46 36 50 38" stroke="${theme.ink}" stroke-width="6" stroke-linecap="round" fill="none" />
      `;
    case 'starter_bag':
    case 'trefoil_sack':
    case 'birchbark_hook':
    case 'hollow_log':
    case 'twisted_stalk':
    case 'spiral_cap':
    case 'mycelium_vine':
      return `
        <path d="M18 24 H62 L68 58 C66 66 54 70 40 70 C26 70 14 66 12 58 Z" fill="${theme.glow}" stroke="${theme.border}" stroke-width="4" />
        <path d="M28 24 C28 14 52 14 52 24" stroke="${theme.border}" stroke-width="5" fill="none" stroke-linecap="round" />
        <path d="M24 42 C34 48 48 48 58 42" stroke="${theme.accent}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.8" />
        <circle cx="56" cy="32" r="4" fill="${theme.ink}" opacity="0.55" />
      `;
    default:
      if (artifact.family === 'armor') {
        return `<path d="M20 24 C30 16 50 16 60 24 C60 44 52 58 40 66 C28 58 20 44 20 24 Z" fill="${theme.accent}" stroke="${theme.border}" stroke-width="5" />`;
      }
      if (artifact.family === 'stun') {
        return `<path d="M42 14 L30 38 H44 L36 66 L56 34 H42 Z" fill="${theme.accent}" stroke="${theme.ink}" stroke-width="5" stroke-linejoin="round" />`;
      }
      return `<path d="M24 60 L56 18" stroke="${theme.ink}" stroke-width="9" stroke-linecap="round" /><path d="M48 16 L62 30" stroke="${theme.accent}" stroke-width="8" stroke-linecap="round" />`;
  }
}

export function renderArtifactSvgContent(artifact, theme, width, height) {
  const pixelWidth = Math.max(1, width) * 80;
  const pixelHeight = Math.max(1, height) * 80;
  const inset = 5;
  const rx = artifact.family === 'bag' ? 18 : 22;
  const cx = pixelWidth / 2;
  const cy = pixelHeight / 2;
  const glyphTranslateX = cx - 40;
  const glyphTranslateY = cy - 40;
  const longAxis = Math.max(pixelWidth, pixelHeight);
  const isWide = pixelWidth > pixelHeight;
  const isTall = pixelHeight > pixelWidth;

  const familyOrnament = artifact.family === 'armor'
    ? `<path d="M${inset + 16} ${cy} C${cx - 22} ${cy - 20} ${cx + 22} ${cy + 20} ${pixelWidth - inset - 16} ${cy}" stroke="${theme.border}" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.42" />`
    : artifact.family === 'stun'
      ? `<path d="M${cx - 18} ${inset + 12} L${cx - 34} ${cy} H${cx + 4} L${cx - 12} ${pixelHeight - inset - 12} L${cx + 34} ${cy - 4} H${cx - 4} Z" fill="${theme.accent}" opacity="0.18" />`
      : artifact.family === 'bag'
        ? `<path d="M${inset + 22} ${inset + 26} C${cx - 22} ${inset + 4} ${cx + 22} ${inset + 4} ${pixelWidth - inset - 22} ${inset + 26}" stroke="${theme.border}" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.58" />`
        : `<path d="M${inset + 18} ${pixelHeight - inset - 18} C${cx - 28} ${cy + 12} ${cx + 28} ${cy - 12} ${pixelWidth - inset - 18} ${inset + 18}" stroke="${theme.border}" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.38" />`;

  const spanMotif = isWide
    ? `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(30, longAxis * 0.34)}" ry="${Math.max(18, pixelHeight * 0.22)}" fill="${theme.glow}" opacity="0.72" />`
    : isTall
      ? `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(18, pixelWidth * 0.24)}" ry="${Math.max(30, longAxis * 0.34)}" fill="${theme.glow}" opacity="0.72" />`
      : `<circle cx="${cx}" cy="${cy}" r="${Math.min(pixelWidth, pixelHeight) * 0.3}" fill="${theme.glow}" opacity="0.72" />`;

  return `
    <rect x="${inset}" y="${inset}" width="${pixelWidth - inset * 2}" height="${pixelHeight - inset * 2}" rx="${rx}" fill="${theme.shell}" stroke="${theme.border}" stroke-width="7" />
    <rect x="${inset + 8}" y="${inset + 8}" width="${pixelWidth - inset * 2 - 16}" height="${pixelHeight - inset * 2 - 16}" rx="${Math.max(10, rx - 6)}" fill="${theme.glow}" opacity="0.72" />
    ${spanMotif}
    ${familyOrnament}
    <g transform="translate(${glyphTranslateX} ${glyphTranslateY})">
      ${renderArtifactGlyph(artifact, theme)}
    </g>
    <path d="M${inset + 12} ${inset + 14} C${cx - 12} ${inset + 2} ${cx + 12} ${inset + 2} ${pixelWidth - inset - 12} ${inset + 14}" stroke="rgba(255,255,255,0.58)" stroke-width="5" stroke-linecap="round" fill="none" />
  `;
}

export function artifactBitmapPath(artifact) {
  return artifact?.id ? `/artifacts/${artifact.id}.png` : '';
}

export function artifactRoleGlyphLabel(role) {
  const labels = {
    damage: 'Damage role',
    armor: 'Armor role',
    stun: 'Stun role',
    bag: 'Bag role'
  };
  return labels[role?.id] || 'Artifact role';
}

export function renderArtifactRoleGlyph(visual, className = '') {
  return `
    <span
      class="artifact-role-glyph artifact-role-glyph--${visual.role.id} ${className}"
      aria-label="${artifactRoleGlyphLabel(visual.role)}"
      title="${artifactRoleGlyphLabel(visual.role)}"
    >
      <span aria-hidden="true"></span>
    </span>
  `;
}

export function renderArtifactFigure(artifact, displayWidth, displayHeight) {
  if (!artifact) {
    return '';
  }
  const theme = artifactTheme(artifact);
  const visual = artifactVisualClassification(artifact);
  const isBag = artifact.family === 'bag';
  // Tetromino-shaped bags carry a 2D shape mask. Cells with mask=0 are
  // empty space inside the bounding box and render as transparent gaps
  // so the shop preview shows the actual tetromino silhouette. Falls
  // through to "all filled" for combat artifacts and rectangular bags.
  // Shape-bearing bags pin their preview dimensions to the shape so
  // preferredOrientation's landscape rotation can't clip non-rectangular
  // pieces (e.g. the 1×4 I-bag).
  const shape = isBag && artifact.shape ? artifact.shape : null;
  const w = shape
    ? (shape[0]?.length || 0)
    : (Number(displayWidth) > 0 ? Number(displayWidth) : artifact.width);
  const h = shape
    ? shape.length
    : (Number(displayHeight) > 0 ? Number(displayHeight) : artifact.height);
  const rotatedBitmap = !shape
    && Number(artifact.width) !== Number(artifact.height)
    && Number(w) === Number(artifact.height)
    && Number(h) === Number(artifact.width);
  const cells = Array.from({ length: w * h }, (_, index) => {
    const x = index % w;
    const y = Math.floor(index / w);
    if (shape) {
      const filled = shape[y] && shape[y][x];
      if (!filled) {
        return `<div class="artifact-figure-cell artifact-figure-cell--empty"></div>`;
      }
    }
    return `<div class="artifact-figure-cell"></div>`;
  }).join('');
  return `
    <div
      class="artifact-figure-grid ${visual.cssClasses.join(' ')}"
      style="grid-template-columns: repeat(${w}, minmax(0, 1fr)); grid-template-rows: repeat(${h}, minmax(0, 1fr)); --artifact-role-color: ${visual.role.color};"
    >
      ${cells}
      <span
        class="artifact-figure-bitmap artifact-figure-bitmap--full${rotatedBitmap ? ' artifact-figure-bitmap--rotated' : ''}"
        aria-hidden="true"
        style="background-image: url('${artifactBitmapPath(artifact)}');${rotatedBitmap ? ` --artifact-rotated-bitmap-width: ${(h / w) * 100}%; --artifact-rotated-bitmap-height: ${(w / h) * 100}%;` : ''}"
      ></span>
      ${renderArtifactRoleGlyph(visual, 'artifact-figure-role-glyph')}
    </div>
  `;
}
