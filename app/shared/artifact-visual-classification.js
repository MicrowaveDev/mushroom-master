export const ARTIFACT_ROLE_CLASSES = {
  damage: {
    id: 'damage',
    label: 'Damage',
    hue: 'amber-red',
    color: '#d9612b',
    prompt: 'damage class color: saturated amber, red-orange, burnt sienna, warm cream highlight'
  },
  armor: {
    id: 'armor',
    label: 'Armor',
    hue: 'moss-green',
    color: '#6f9b4f',
    prompt: 'armor class color: moss green, olive, bark brown, muted stone, warm cream highlight'
  },
  stun: {
    id: 'stun',
    label: 'Stun',
    hue: 'gold-yellow',
    color: '#d5b735',
    prompt: 'stun class color: pale gold, yellow-green, electric olive, smoky cream highlight'
  },
  bag: {
    id: 'bag',
    label: 'Bag',
    hue: 'container',
    color: '#b98245',
    prompt: 'bag class color: warm canvas, amber leather, bark, moss cloth, mycelium fiber'
  }
};

export const ARTIFACT_SHINE_TIERS = {
  plain: {
    id: 'plain',
    label: 'Plain',
    rank: 1,
    cssClass: 'artifact-shine--plain',
    prompt: 'plain shine: mostly matte, one small highlight, no glow aura'
  },
  bright: {
    id: 'bright',
    label: 'Bright',
    rank: 2,
    cssClass: 'artifact-shine--bright',
    prompt: 'bright shine: one strong highlight shape, modest inner glow, no outer glow'
  },
  radiant: {
    id: 'radiant',
    label: 'Radiant',
    rank: 3,
    cssClass: 'artifact-shine--radiant',
    prompt: 'radiant shine: clear polished highlight, richer saturation, subtle rim accent, no particle spray'
  },
  signature: {
    id: 'signature',
    label: 'Signature',
    rank: 4,
    cssClass: 'artifact-shine--signature',
    prompt: 'signature shine: distinctive hero-item highlight, saturated accent, one emblem-like glow contained inside the silhouette'
  }
};

export const ARTIFACT_STAT_ORDER = ['damage', 'armor', 'speed', 'stun'];

export const ARTIFACT_PRIMARY_STAT_BY_ROLE = {
  damage: 'damage',
  armor: 'armor',
  stun: 'stunChance',
  bag: null
};

export function canonicalArtifactStatKey(key) {
  return key === 'stunChance' ? 'stun' : key;
}

export function artifactRoleClass(artifact) {
  if (!artifact) return ARTIFACT_ROLE_CLASSES.damage;
  if (artifact.family === 'bag') return ARTIFACT_ROLE_CLASSES.bag;
  return ARTIFACT_ROLE_CLASSES[artifact.family] || ARTIFACT_ROLE_CLASSES.damage;
}

export function artifactShineTier(artifact) {
  if (!artifact) return ARTIFACT_SHINE_TIERS.plain;
  if (artifact.characterItem) return ARTIFACT_SHINE_TIERS.signature;
  if (artifact.starterOnly && artifact.family !== 'bag') return ARTIFACT_SHINE_TIERS.signature;
  if (artifact.family === 'bag' && Number(artifact.price) >= 3) return ARTIFACT_SHINE_TIERS.radiant;
  if (Number(artifact.price) >= 3) return ARTIFACT_SHINE_TIERS.radiant;
  if (Number(artifact.price) >= 2 || (Number(artifact.width) || 1) * (Number(artifact.height) || 1) >= 2) {
    return ARTIFACT_SHINE_TIERS.bright;
  }
  return ARTIFACT_SHINE_TIERS.plain;
}

export function artifactPrimaryStatKey(artifact) {
  const role = artifactRoleClass(artifact);
  return ARTIFACT_PRIMARY_STAT_BY_ROLE[role.id] ?? null;
}

export function artifactSecondaryStats(artifact) {
  const bonus = artifact?.bonus || {};
  const primary = artifactPrimaryStatKey(artifact);
  return ARTIFACT_STAT_ORDER.filter((stat) => {
    const rawKey = stat === 'stun' ? 'stunChance' : stat;
    return rawKey !== primary && Number(bonus[rawKey] || 0) > 0;
  });
}

export function artifactTradeoffs(artifact) {
  const bonus = artifact?.bonus || {};
  return ARTIFACT_STAT_ORDER.filter((stat) => {
    const rawKey = stat === 'stun' ? 'stunChance' : stat;
    return Number(bonus[rawKey] || 0) < 0;
  });
}

export function artifactOwner(artifact) {
  return artifact?.characterItem?.mushroomId || null;
}

export function artifactFootprintType(artifact) {
  if (!artifact) return 'single';
  if (artifact.family === 'bag' && Array.isArray(artifact.shape)) return 'mask';
  const width = Number(artifact.width) || 1;
  const height = Number(artifact.height) || 1;
  if (width === 1 && height === 1) return 'single';
  if (width > height) return 'wide';
  if (height > width) return 'tall';
  return 'block';
}

export function artifactVisualClassification(artifact) {
  const role = artifactRoleClass(artifact);
  const shine = artifactShineTier(artifact);
  return {
    role,
    shine,
    primaryStatKey: artifactPrimaryStatKey(artifact),
    secondaryStats: artifactSecondaryStats(artifact),
    tradeoffs: artifactTradeoffs(artifact),
    owner: artifactOwner(artifact),
    footprintType: artifactFootprintType(artifact),
    cssClasses: [
      `artifact-role--${role.id}`,
      shine.cssClass
    ],
    prompt: `${role.prompt}. ${shine.prompt}.`
  };
}
