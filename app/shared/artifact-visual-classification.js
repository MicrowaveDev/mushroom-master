import {
  createArtifactVisualClassifier
} from '@microwavedev/backpack-game-core/artifact-visual-classification';

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

const mushroomArtifactVisualClassifier = createArtifactVisualClassifier({
  roleClasses: ARTIFACT_ROLE_CLASSES,
  shineTiers: ARTIFACT_SHINE_TIERS,
  statOrder: ARTIFACT_STAT_ORDER,
  primaryStatByRole: ARTIFACT_PRIMARY_STAT_BY_ROLE,
  ownerForArtifact: (artifact) => artifact?.characterItem?.mushroomId || null
});

export const {
  canonicalArtifactStatKey,
  artifactRoleClass,
  artifactShineTier,
  artifactPrimaryStatKey,
  artifactSecondaryStats,
  artifactTradeoffs,
  artifactOwner,
  artifactFootprintShape,
  artifactFootprintDimensions,
  artifactFootprintType,
  artifactVisualClassification
} = mushroomArtifactVisualClassifier;
