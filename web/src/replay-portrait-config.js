const portraitLayout = ({ top, insetLeft, insetRight, tailLeft, imagePosition, headX = 50, headY = 34 }) => ({
  top,
  insetLeft,
  insetRight,
  tailLeft,
  imagePosition,
  headX,
  headY
});

export const replayPortraitConfigByMushroom = {
  thalla: {
    default: portraitLayout({ top: '30px', insetLeft: '20px', insetRight: '20px', tailLeft: '47%', imagePosition: '50% 12%' }),
    1: portraitLayout({ top: '26px', insetLeft: '18px', insetRight: '18px', tailLeft: '44%', imagePosition: '50% 30%' }),
    2: portraitLayout({ top: '18px', insetLeft: '18px', insetRight: '18px', tailLeft: '50%', imagePosition: '50% 2%', headY: 36 })
  },
  lomie: {
    default: portraitLayout({ top: '30px', insetLeft: '20px', insetRight: '18px', tailLeft: '52%', imagePosition: '52% 8%' }),
    1: portraitLayout({ top: '26px', insetLeft: '18px', insetRight: '20px', tailLeft: '54%', imagePosition: '50% 28%' }),
    2: portraitLayout({ top: '24px', insetLeft: '18px', insetRight: '18px', tailLeft: '50%', imagePosition: '50% 22%' })
  },
  axilin: {
    default: portraitLayout({ top: '24px', insetLeft: '18px', insetRight: '18px', tailLeft: '52%', imagePosition: '50% 8%' }),
    1: portraitLayout({ top: '26px', insetLeft: '18px', insetRight: '18px', tailLeft: '48%', imagePosition: '50% 24%' }),
    2: portraitLayout({ top: '18px', insetLeft: '18px', insetRight: '18px', tailLeft: '52%', imagePosition: '50% 2%', headY: 36 })
  },
  kirt: {
    default: portraitLayout({ top: '18px', insetLeft: '18px', insetRight: '20px', tailLeft: '45%', imagePosition: '48% 0%', headY: 34 }),
    1: portraitLayout({ top: '24px', insetLeft: '18px', insetRight: '18px', tailLeft: '50%', imagePosition: '50% 28%' })
  },
  morga: {
    default: portraitLayout({ top: '24px', insetLeft: '18px', insetRight: '18px', tailLeft: '56%', imagePosition: '54% 8%' })
  },
  dalamar: {
    default: portraitLayout({ top: '26px', insetLeft: '18px', insetRight: '18px', tailLeft: '48%', imagePosition: '50% 22%' }),
    1: portraitLayout({ top: '24px', insetLeft: '18px', insetRight: '18px', tailLeft: '48%', imagePosition: '50% 28%' }),
    2: portraitLayout({ top: '18px', insetLeft: '18px', insetRight: '18px', tailLeft: '52%', imagePosition: '50% 2%', headY: 36 })
  }
};

export const defaultReplayPortraitConfig = replayPortraitConfigByMushroom.thalla.default;

export function replayPortraitConfig(mushroomId, portraitId = 'default') {
  const characterConfig = replayPortraitConfigByMushroom[mushroomId];
  if (!characterConfig) return defaultReplayPortraitConfig;
  return characterConfig[portraitId] || characterConfig.default || defaultReplayPortraitConfig;
}
