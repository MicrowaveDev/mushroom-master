import { CharactersScreen as CoreCharactersScreen } from '@microwavedev/backpack-game-core/vue/pages';

export const CharactersScreen = {
  name: 'MushroomCharactersScreen',
  components: { CoreCharactersScreen },
  props: ['state', 't', 'portraitPosition'],
  emits: ['save-character'],
  template: `
    <core-characters-screen
      :characters="state.bootstrap.mushrooms"
      :locale="state.lang"
      :portrait-position="portraitPosition"
      @select-character="$emit('save-character', $event)"
    />
  `
};
