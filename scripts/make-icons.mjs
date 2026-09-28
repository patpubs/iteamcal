// Draws the iTeamCal icon and renders every size the app needs.
// Run from the repo root after changing the design; Playwright is not a project
// dependency, so run it wherever Playwright is installed with NODE_PATH set.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PINE = '#1F6F5C';
const DEEP = '#10352C';
const AMBER = '#E39A2D';

// The calendar page, drawn in a 100×100 box.
const glyph = (paper = '#FFFFFF', ink = PINE, band = AMBER) => `
  <rect x="18" y="24" width="64" height="58" rx="10" fill="${paper}"/>
  <path d="M18 34a10 10 0 0 1 10-10h44a10 10 0 0 1 10 10v8H18z" fill="${band}"/>
  <rect x="31" y="15" width="7" height="17" rx="3.5" fill="${paper}" stroke="${DEEP}" stroke-width="2.5"/>
  <rect x="62" y="15" width="7" height="17" rx="3.5" fill="${paper}" stroke="${DEEP}" stroke-width="2.5"/>
  <g fill="${ink}" opacity="0.35">
    <rect x="28" y="50" width="10" height="8" rx="2"/><rect x="45" y="50" width="10" height="8" rx="2"/>
    <rect x="62" y="50" width="10" height="8" rx="2"/><rect x="28" y="64" width="10" height="8" rx="2"/>
  </g>
  <rect x="45" y="64" width="10" height="8" rx="2" fill="${ink}"/>
  <path d="M60.5 68l4 4 8-9" fill="none" stroke="${band}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;

const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${PINE}"/><stop offset="1" stop-color="${DEEP}"/></linearGradient></defs>`;

// scale shrinks the glyph toward the center (for safe zones).
const svg = ({ size, background = 'square', scale = 1, content = glyph() }) => {
  const pad = (100 - 100 * scale) / 2;
  const back =
    background === 'square'
      ? `${bg}<rect width="100" height="100" fill="url(#g)"/>`
      : background === 'rounded'
        ? `${bg}<rect width="100" height="100" rx="22" fill="url(#g)"/>`
        : background === 'solid'
          ? `<rect width="100" height="100" fill="${PINE}"/>`
          : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${back}
    <g transform="translate(${pad} ${pad}) scale(${scale})">${content}</g></svg>`;
};

const outputs = [
  // Store and home-screen icons are full-bleed squares; the OS rounds them.
  ['assets/images/icon.png', svg({ size: 1024 })],
  ['public/icon-512.png', svg({ size: 512 })],
  ['public/icon-192.png', svg({ size: 192 })],
  ['public/apple-touch-icon.png', svg({ size: 180 })],
  // Maskable icons can be cropped to a circle, so the glyph keeps to the middle 80%.
  ['public/icon-maskable-512.png', svg({ size: 512, scale: 0.8 })],
  // The logo in the desktop sidebar.
  ['assets/images/logo.png', svg({ size: 96 })],
  ['assets/images/favicon.png', svg({ size: 48, background: 'rounded', scale: 1.12 })],
  // Android adaptive icon layers: the foreground stays inside the 66% safe zone.
  ['assets/images/android-icon-foreground.png', svg({ size: 1024, background: 'none', scale: 0.62 })],
  ['assets/images/android-icon-background.png', svg({ size: 1024, background: 'square', content: '' })],
  [
    'assets/images/android-icon-monochrome.png',
    svg({ size: 1024, background: 'none', scale: 0.62, content: glyph('#FFFFFF', '#000000', '#000000') }),
  ],
  ['assets/images/splash-icon.png', svg({ size: 1024, background: 'none', scale: 0.9 })],
];

mkdirSync('public', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
for (const [file, markup] of outputs) {
  const size = Number(markup.match(/width="(\d+)"/)[1]);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.locator('svg').screenshot({ path: file, omitBackground: true });
  console.log(file, size);
}
await browser.close();
