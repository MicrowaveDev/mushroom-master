import { h } from 'vue/dist/vue.esm-bundler.js';
import { artifactTheme } from '../artifacts/render.js';

function node(tag, attrs = {}, children = []) {
  return h(tag, attrs, children);
}

function glyphNodes(artifact, theme) {
  switch (artifact.id) {
    case 'spore_needle':
      return [
        node('ellipse', { cx: '40', cy: '24', rx: '14', ry: '10', fill: theme.accent, opacity: '0.92' }),
        node('path', { d: 'M40 32 L46 74', stroke: theme.ink, 'stroke-width': '8', 'stroke-linecap': 'round' }),
        node('path', { d: 'M32 40 L56 30', stroke: theme.border, 'stroke-width': '5', 'stroke-linecap': 'round' })
      ];
    case 'amber_fang':
      return [
        node('path', { d: 'M42 10 C58 14 60 44 50 78 C46 86 38 86 34 78 C24 48 26 18 42 10 Z', fill: theme.accent }),
        node('path', { d: 'M40 20 C44 32 45 48 42 68', stroke: theme.shell, 'stroke-width': '5', 'stroke-linecap': 'round', opacity: '0.78' })
      ];
    case 'glass_cap':
      return [
        node('path', { d: 'M16 44 C22 24 42 14 64 14 C86 14 106 24 112 44 C104 56 84 60 64 60 C42 60 24 56 16 44 Z', fill: theme.accent }),
        node('path', { d: 'M64 42 L64 62', stroke: theme.ink, 'stroke-width': '8', 'stroke-linecap': 'round' }),
        node('path', { d: 'M34 36 C46 30 80 30 94 36', stroke: theme.shell, 'stroke-width': '5', 'stroke-linecap': 'round', opacity: '0.78' })
      ];
    case 'bark_plate':
      return [
        node('rect', { x: '18', y: '18', width: '44', height: '44', rx: '14', fill: theme.accent }),
        node('path', { d: 'M30 22 C24 36 24 50 30 64', stroke: theme.ink, 'stroke-width': '5', 'stroke-linecap': 'round' }),
        node('path', { d: 'M48 22 C54 36 54 50 48 62', stroke: theme.border, 'stroke-width': '4', 'stroke-linecap': 'round' })
      ];
    case 'mycelium_wrap':
      return [
        node('path', { d: 'M12 38 C24 24 42 22 60 32', stroke: theme.shell, 'stroke-width': '7', 'stroke-linecap': 'round', fill: 'none' }),
        node('path', { d: 'M68 32 C78 44 92 46 108 34', stroke: theme.shell, 'stroke-width': '7', 'stroke-linecap': 'round', fill: 'none' }),
        node('circle', { cx: '60', cy: '38', r: '8', fill: theme.ink, opacity: '0.8' })
      ];
    case 'root_shell':
      return [
        node('path', { d: 'M20 20 C32 12 48 12 60 20 C68 30 68 50 60 62 C48 72 32 72 20 62 C12 50 12 30 20 20 Z', fill: theme.accent }),
        node('path', { d: 'M38 12 L38 70', stroke: theme.border, 'stroke-width': '6', 'stroke-linecap': 'round' })
      ];
    case 'shock_puff':
      return [
        node('path', { d: 'M22 52 C14 38 24 18 42 20 C50 10 68 12 72 28 C88 28 96 44 88 58 C80 70 60 74 42 70 C32 68 24 62 22 52 Z', fill: theme.accent }),
        node('path', { d: 'M52 24 L42 44 H56 L46 64', stroke: theme.ink, 'stroke-width': '7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })
      ];
    case 'static_spore_sac':
      return [
        node('path', { d: 'M42 12 C56 16 60 34 56 56 C52 70 48 78 46 84 C42 88 34 88 30 84 C22 58 24 24 42 12 Z', fill: theme.accent }),
        node('path', { d: 'M40 22 L30 44 H42 L34 68', stroke: theme.ink, 'stroke-width': '6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
        node('circle', { cx: '50', cy: '24', r: '7', fill: theme.shell, opacity: '0.88' })
      ];
    case 'thunder_gill':
      return [
        node('path', { d: 'M14 40 C24 24 42 18 60 18 C80 18 98 24 106 40 C98 52 80 56 60 56 C40 56 22 52 14 40 Z', fill: theme.accent }),
        node('path', { d: 'M42 28 L34 44 H48 L40 58', stroke: theme.ink, 'stroke-width': '6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
        node('path', { d: 'M68 28 L62 42 H74 L66 56', stroke: theme.border, 'stroke-width': '5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })
      ];
    case 'moss_pouch':
      return [
        node('rect', { x: '14', y: '14', width: '52', height: '52', rx: '18', fill: theme.accent, opacity: '0.25', stroke: theme.border, 'stroke-width': '3', 'stroke-dasharray': '6 4' }),
        node('path', { d: 'M30 28 C30 20 50 20 50 28 L52 54 C52 60 28 60 28 54 Z', fill: theme.accent, opacity: '0.5' }),
        node('path', { d: 'M34 22 C34 16 46 16 46 22', stroke: theme.border, 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round' }),
        node('text', { x: '40', y: '50', 'text-anchor': 'middle', 'font-size': '18', 'font-weight': 'bold', fill: theme.ink }, artifact.slotCount ? String(artifact.slotCount) : '')
      ];
    case 'amber_satchel':
      return [
        node('rect', { x: '10', y: '10', width: '60', height: '60', rx: '14', fill: theme.accent, opacity: '0.25', stroke: theme.border, 'stroke-width': '3' }),
        node('rect', { x: '18', y: '22', width: '44', height: '36', rx: '8', fill: theme.accent, opacity: '0.4' }),
        node('path', { d: 'M28 22 L28 16 C28 12 52 12 52 16 L52 22', stroke: theme.border, 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round' }),
        node('rect', { x: '32', y: '28', width: '16', height: '6', rx: '3', fill: theme.border, opacity: '0.6' }),
        node('text', { x: '40', y: '52', 'text-anchor': 'middle', 'font-size': '18', 'font-weight': 'bold', fill: theme.ink }, artifact.slotCount ? String(artifact.slotCount) : '')
      ];
    case 'spore_lash':
      return [
        node('path', { d: 'M20 58 C24 48 34 42 42 34 C49 28 54 24 58 18', stroke: theme.ink, 'stroke-width': '7', 'stroke-linecap': 'round', fill: 'none' }),
        node('path', { d: 'M54 18 L60 12 L62 20 L68 22 L62 26 L60 34 L54 28 L48 30 L50 22 L44 18 Z', stroke: theme.border, 'stroke-width': '4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: theme.accent }),
        node('circle', { cx: '58', cy: '22', r: '5', fill: theme.shell })
      ];
    case 'settling_guard':
      return [
        node('path', { d: 'M18 30 C24 20 34 16 40 16 C46 16 56 20 62 30 C60 42 50 52 40 58 C30 52 20 42 18 30 Z', fill: theme.accent }),
        node('path', { d: 'M24 30 C28 24 34 22 40 22 C46 22 52 24 56 30', stroke: theme.border, 'stroke-width': '5', 'stroke-linecap': 'round', fill: 'none' }),
        node('line', { x1: '22', y1: '62', x2: '58', y2: '62', stroke: theme.ink, 'stroke-width': '6', 'stroke-linecap': 'round' })
      ];
    case 'ferment_phial':
      return [
        node('path', { d: 'M34 16 H46 M36 16 V28 L28 56 C27 61 31 66 36 66 H44 C49 66 53 61 52 56 L44 28 V16', stroke: theme.ink, 'stroke-width': '5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: theme.accent }),
        node('path', { d: 'M31 50 C35 48 45 48 49 50', stroke: theme.shell, 'stroke-width': '4', 'stroke-linecap': 'round', fill: 'none' }),
        node('circle', { cx: '44', cy: '24', r: '5', fill: theme.shell })
      ];
    case 'measured_strike':
      return [
        node('path', { d: 'M40 14 L48 28 L40 62 L32 28 Z', fill: theme.accent, stroke: theme.ink, 'stroke-width': '4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        node('line', { x1: '24', y1: '32', x2: '56', y2: '32', stroke: theme.border, 'stroke-width': '6', 'stroke-linecap': 'round' }),
        node('line', { x1: '40', y1: '18', x2: '40', y2: '60', stroke: theme.shell, 'stroke-width': '4', 'stroke-linecap': 'round' })
      ];
    case 'flash_cap':
      return [
        node('path', { d: 'M18 42 C22 28 30 20 40 20 C50 20 58 28 62 42 C56 48 48 50 40 50 C32 50 24 48 18 42 Z', fill: theme.accent }),
        node('path', { d: 'M40 50 L40 62 M28 24 L24 18 M40 18 L40 12 M52 24 L56 18 M60 32 L66 28', stroke: theme.border, 'stroke-width': '5', 'stroke-linecap': 'round', fill: 'none' }),
        node('path', { d: 'M30 38 C34 36 46 36 50 38', stroke: theme.ink, 'stroke-width': '6', 'stroke-linecap': 'round', fill: 'none' })
      ];
    default:
      return [node('rect', { x: '18', y: '18', width: '44', height: '44', rx: '14', fill: theme.accent })];
  }
}

export const ArtifactFigure = {
  name: 'ArtifactFigure',
  props: {
    artifact: { type: Object, default: null },
    displayWidth: { type: Number, default: 0 },
    displayHeight: { type: Number, default: 0 }
  },
  render() {
    const artifact = this.artifact;
    if (!artifact) return null;

    const theme = artifactTheme(artifact);
    const isBag = artifact.family === 'bag';
    const shape = isBag && artifact.shape ? artifact.shape : null;
    const width = shape
      ? (shape[0]?.length || 0)
      : (Number(this.displayWidth) > 0 ? Number(this.displayWidth) : artifact.width);
    const height = shape
      ? shape.length
      : (Number(this.displayHeight) > 0 ? Number(this.displayHeight) : artifact.height);

    const cells = Array.from({ length: width * height }, (_, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      if (shape && !(shape[y] && shape[y][x])) {
        return node('div', { class: 'artifact-figure-cell artifact-figure-cell--empty', key: index });
      }
      return node('div', { class: 'artifact-figure-cell', key: index }, [
        node('svg', {
          class: 'artifact-figure-svg',
          viewBox: '0 0 80 80',
          preserveAspectRatio: 'xMidYMid meet',
          'aria-hidden': 'true'
        }, [
          node('rect', { x: '4', y: '4', width: '72', height: '72', rx: '20', fill: theme.shell, stroke: theme.border, 'stroke-width': '6' }),
          node('rect', { x: '10', y: '10', width: '60', height: '60', rx: '16', fill: theme.glow, opacity: '0.8' }),
          ...(isBag ? [] : glyphNodes(artifact, theme))
        ])
      ]);
    });

    return node('div', {
      class: 'artifact-figure-grid',
      style: {
        gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${height}, minmax(0, 1fr))`
      }
    }, cells);
  }
};
