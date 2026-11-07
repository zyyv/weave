import {iconMarkup} from './vendor/hugeicons/icons.js';

export function iconSvg(name) {
  return iconMarkup[name] ?? iconMarkup.file;
}

export function icon(name) {
  return `<i>${iconSvg(name)}</i>`;
}

export function renderIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(element => {
    element.innerHTML = iconSvg(element.dataset.icon);
  });
}

// Video.js exposes a registry that also updates icons already mounted in its skin.
// Register after loading the skin, which otherwise installs its own Neutral icons.
export function registerVideoIcons() {
  const aliases = {
    play: 'play', pause: 'pause', restart: 'restart',
    'volume-high': 'volumeHigh', 'volume-low': 'volumeLow', 'volume-off': 'volumeOff',
    'fullscreen-enter': 'fullscreenEnter', 'fullscreen-exit': 'fullscreenExit',
    'pip-enter': 'pipEnter', 'pip-exit': 'pipExit',
    'airplay-enter': 'airplay', 'airplay-exit': 'airplay',
    'cast-enter': 'cast', 'cast-exit': 'cast',
    'captions-on': 'captions', 'captions-off': 'captions',
    gear: 'settings', check: 'check', chevron: 'chevron',
    switches: 'switches', speed: 'speed', speech: 'speech', spinner: 'spinner',
  };
  customElements.get('media-icon').register('neutral',
    Object.fromEntries(Object.entries(aliases).map(([name, alias]) => [name, iconSvg(alias)])));
}
