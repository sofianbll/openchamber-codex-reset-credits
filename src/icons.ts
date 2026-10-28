// One stroke icon set for every surface: 24px grid, round caps and joins, no fills, `currentColor`.
// Stroke width follows the rendered size (`--s`, in px) so every glyph keeps a ~1.4px line.
export const ICONS = {
  ticket: '<path d="M4 6.5h16a1 1 0 0 1 1 1V10a2 2 0 0 0 0 4v2.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V14a2 2 0 0 0 0-4V7.5a1 1 0 0 1 1-1Z"/><path d="M15 9.5v.01M15 12v.01M15 14.5v.01"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7"/><path d="M12 8v12.5"/><path d="M12 8C11 5.5 9.6 4 8.2 4 7 4 6.5 4.8 6.5 5.7 6.5 7 8 8 12 8Zm0 0c1-2.5 2.4-4 3.8-4 1.2 0 1.7.8 1.7 1.7 0 1.3-1.5 2.3-5.5 2.3Z"/>',
  hourglass: '<path d="M6.5 3.5h11M6.5 20.5h11"/><path d="M8 3.5v2.8c0 1.2.5 2.3 1.4 3.1L12 12l2.6-2.6c.9-.8 1.4-1.9 1.4-3.1V3.5"/><path d="M8 20.5v-2.8c0-1.2.5-2.3 1.4-3.1L12 12l2.6 2.6c.9.8 1.4 1.9 1.4 3.1v2.8"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-4.9"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 0 1 4.85.85c0 1.65-2.45 2.2-2.45 3.3"/><path d="M12 16.6v.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8v.01"/>',
  alert: '<path d="M10.3 4.6 3.1 17a2 2 0 0 0 1.7 3h14.4a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4"/><path d="M12 16.8v.01"/>',
  login: '<path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14"/><path d="m10 16 4-4-4-4"/><path d="M14 12H4.5"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>',
  chevron: '<path d="m9.5 6.5 5.5 5.5-5.5 5.5"/>',
  panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15"/>',
  settings: '<path d="m9.5 3.5-.6 2.3-2 .9-2.2-.6-2.5 4.3L4 12l-1.8 1.6 2.5 4.3 2.2-.6 2 .9.6 2.3h5l.6-2.3 2-.9 2.2.6 2.5-4.3L20 12l1.8-1.6-2.5-4.3-2.2.6-2-.9-.6-2.3Z"/><circle cx="12" cy="12" r="3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  // The logo's ticket and reset arrow, for illustrations.
  art: '<path d="M109 64a45 45 0 1 1-13-32"/><path d="m94 17 3 16-16-2"/><path d="M43 48h42a3 3 0 0 1 3 3v7a6 6 0 0 0 0 12v7a3 3 0 0 1-3 3H43a3 3 0 0 1-3-3v-7a6 6 0 0 0 0-12v-7a3 3 0 0 1 3-3Z"/><path d="M57 56v.01M57 64v.01M57 72v.01"/>',
} as const;

export type IconName = keyof typeof ICONS;

const BOX: Partial<Record<IconName, string>> = { art: '0 0 128 128' };
const SVG = 'http://www.w3.org/2000/svg';
const CSS = `.icon{--s:16;flex:none;width:calc(var(--s)*1px);height:calc(var(--s)*1px);fill:none;stroke:currentColor;stroke-width:calc(33.6/var(--s));stroke-linecap:round;stroke-linejoin:round}.icon-art{stroke-width:calc(180/var(--s))}`;

/** Adds the sprite and the base `.icon` rule once per document. */
export function installIcons(doc: Document = document): void {
  if (doc.getElementById('cr-icons')) return;
  const sprite = doc.createElementNS(SVG, 'svg');
  sprite.id = 'cr-icons';
  sprite.setAttribute('aria-hidden', 'true');
  sprite.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  sprite.innerHTML = Object.entries(ICONS)
    .map(([name, body]) => `<symbol id="cr-${name}" viewBox="${BOX[name as IconName] ?? '0 0 24 24'}">${body}</symbol>`).join('');
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.append(style);
  doc.body.prepend(sprite);
}

/** Decorative unless `label` is given, which makes it an image with that name. */
export function icon(name: IconName, label?: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', `icon icon-${name}`);
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `#cr-${name}`);
  svg.append(use);
  return svg;
}
