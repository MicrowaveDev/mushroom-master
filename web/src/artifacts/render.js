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
    case 'amber_fang':
      return `
        <path d="M42 10 C58 14 60 44 50 78 C46 86 38 86 34 78 C24 48 26 18 42 10 Z" fill="${theme.accent}" />
        <path d="M40 20 C44 32 45 48 42 68" stroke="${theme.shell}" stroke-width="5" stroke-linecap="round" opacity="0.78" />
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
    case 'shock_puff':
      return `
        <path d="M22 52 C14 38 24 18 42 20 C50 10 68 12 72 28 C88 28 96 44 88 58 C80 70 60 74 42 70 C32 68 24 62 22 52 Z" fill="${theme.accent}" />
        <path d="M52 24 L42 44 H56 L46 64" stroke="${theme.ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />
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
    default:
      return `<rect x="18" y="18" width="44" height="44" rx="14" fill="${theme.accent}" />`;
  }
}

export function renderArtifactFigure(artifact, displayWidth, displayHeight) {
  if (!artifact) {
    return '';
  }
  const theme = artifactTheme(artifact);
  const w = Number(displayWidth) > 0 ? Number(displayWidth) : artifact.width;
  const h = Number(displayHeight) > 0 ? Number(displayHeight) : artifact.height;
  const isBag = artifact.family === 'bag';
  const cells = Array.from({ length: w * h }, (_, index) => {
    const x = index % w;
    const y = Math.floor(index / w);
    return `
      <div class="artifact-figure-cell">
        <svg class="artifact-figure-svg" viewBox="0 0 80 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect x="4" y="4" width="72" height="72" rx="20" fill="${theme.shell}" stroke="${theme.border}" stroke-width="6" />
          <rect x="10" y="10" width="60" height="60" rx="16" fill="${theme.glow}" opacity="0.8" />
          ${isBag ? '' : renderArtifactGlyph(artifact, theme, x, y)}
        </svg>
      </div>
    `;
  }).join('');
  return `
    <div
      class="artifact-figure-grid"
      style="grid-template-columns: repeat(${w}, minmax(0, 1fr)); grid-template-rows: repeat(${h}, minmax(0, 1fr));"
    >
      ${cells}
    </div>
  `;
}
