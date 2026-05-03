const portraitLayout = ({
  top = '48%',
  underhang = '0px',
  insetLeft,
  insetRight,
  tailLeft,
  tailEdge = 'top',
  imagePosition,
  headX = 50,
  headY = 34,
  faceTop = 18,
  faceBottom = 40
}) => ({
  top,
  underhang,
  insetLeft,
  insetRight,
  tailLeft,
  tailEdge,
  imagePosition,
  headX,
  headY,
  faceTop,
  faceBottom
});

export const replayPortraitConfigByMushroom = {
  thalla: {
    default: portraitLayout({ insetLeft: '20px', insetRight: '20px', tailLeft: '47%', imagePosition: '50% 12%' }),
    1: portraitLayout({ top: '44%', insetLeft: '18px', insetRight: '18px', tailLeft: '44%', imagePosition: '50% 100%', faceBottom: 34 }),
    2: portraitLayout({ insetLeft: '18px', insetRight: '18px', tailLeft: '50%', imagePosition: '50% 2%', headY: 36 })
  },
  lomie: {
    default: portraitLayout({ insetLeft: '20px', insetRight: '18px', tailLeft: '52%', imagePosition: '52% 8%' }),
    1: portraitLayout({ top: '51%', insetLeft: '18px', insetRight: '20px', tailLeft: '54%', imagePosition: '50% 100%', faceBottom: 38 }),
    2: portraitLayout({ top: '54%', insetLeft: '18px', insetRight: '18px', tailLeft: '50%', imagePosition: '50% 22%', faceBottom: 46 })
  },
  axilin: {
    default: portraitLayout({ insetLeft: '18px', insetRight: '18px', tailLeft: '52%', imagePosition: '50% 8%' }),
    1: portraitLayout({ top: '66%', insetLeft: '18px', insetRight: '18px', tailLeft: '48%', imagePosition: '50% 100%', faceBottom: 56 }),
    2: portraitLayout({ insetLeft: '18px', insetRight: '18px', tailLeft: '52%', imagePosition: '50% 2%', headY: 36 })
  },
  kirt: {
    default: portraitLayout({ insetLeft: '18px', insetRight: '20px', tailLeft: '45%', imagePosition: '48% 0%', headY: 34 }),
    1: portraitLayout({ top: '66%', insetLeft: '18px', insetRight: '18px', tailLeft: '50%', imagePosition: '50% 100%', faceBottom: 56 })
  },
  morga: {
    default: portraitLayout({ top: '8%', insetLeft: '18px', insetRight: '18px', tailLeft: '56%', tailEdge: 'bottom', imagePosition: '54% 8%', faceTop: 34, faceBottom: 54 })
  },
  dalamar: {
    default: portraitLayout({ insetLeft: '18px', insetRight: '18px', tailLeft: '48%', imagePosition: '50% 22%' }),
    1: portraitLayout({ top: '66%', insetLeft: '18px', insetRight: '18px', tailLeft: '48%', imagePosition: '50% 100%', faceBottom: 56 }),
    2: portraitLayout({ insetLeft: '18px', insetRight: '18px', tailLeft: '52%', imagePosition: '50% 2%', headY: 36 })
  }
};

export const defaultReplayPortraitConfig = replayPortraitConfigByMushroom.thalla.default;

export function replayPortraitConfig(mushroomId, portraitId = 'default') {
  const characterConfig = replayPortraitConfigByMushroom[mushroomId];
  if (!characterConfig) return defaultReplayPortraitConfig;
  return characterConfig[portraitId] || characterConfig.default || defaultReplayPortraitConfig;
}
