// Generates the simple cartoon animal PNGs used as seed card images / avatars.
// Each animal is authored as a flat SVG and rasterized to a 512x512 PNG with
// rsvg-convert (a system tool; install librsvg if it is missing). The resulting
// PNGs are committed so seeding does not depend on any local-only assets.
//
// Run with: node supabase/seeds/images/generate-animal-images.mjs

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIZE = 512;

const eyes = (lx, rx, y, r = 18) => `
  <circle cx="${lx}" cy="${y}" r="${r}" fill="#2b2b2b"/>
  <circle cx="${rx}" cy="${y}" r="${r}" fill="#2b2b2b"/>
  <circle cx="${lx - r / 3}" cy="${y - r / 3}" r="${r / 3.5}" fill="#ffffff"/>
  <circle cx="${rx - r / 3}" cy="${y - r / 3}" r="${r / 3.5}" fill="#ffffff"/>`;

const frame = (bg, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${bg}"/>
  ${inner}
</svg>`;

const ANIMALS = {
  cat: frame(
    '#FFE0B2',
    `<polygon points="150,150 120,40 232,118" fill="#F4A23C"/>
     <polygon points="362,150 392,40 280,118" fill="#F4A23C"/>
     <polygon points="160,138 144,78 206,124" fill="#F8C9A0"/>
     <polygon points="352,138 368,78 306,124" fill="#F8C9A0"/>
     <circle cx="256" cy="282" r="150" fill="#F4A23C"/>
     ${eyes(205, 307, 262, 24)}
     <polygon points="256,300 238,318 274,318" fill="#E8728C"/>
     <path d="M256 318 q-20 26 -42 6" stroke="#2b2b2b" stroke-width="5" fill="none" stroke-linecap="round"/>
     <path d="M256 318 q20 26 42 6" stroke="#2b2b2b" stroke-width="5" fill="none" stroke-linecap="round"/>
     <line x1="150" y1="300" x2="206" y2="306" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
     <line x1="150" y1="326" x2="206" y2="322" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
     <line x1="362" y1="300" x2="306" y2="306" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
     <line x1="362" y1="326" x2="306" y2="322" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>`,
  ),

  dog: frame(
    '#D7CCC8',
    `<ellipse cx="138" cy="250" rx="46" ry="112" fill="#8D6E63"/>
     <ellipse cx="374" cy="250" rx="46" ry="112" fill="#8D6E63"/>
     <circle cx="256" cy="250" r="150" fill="#A1887F"/>
     <ellipse cx="256" cy="322" rx="84" ry="66" fill="#EFEBE9"/>
     ${eyes(210, 302, 222, 20)}
     <ellipse cx="256" cy="300" rx="27" ry="19" fill="#2b2b2b"/>
     <path d="M256 319 v24" stroke="#5D4037" stroke-width="5" fill="none" stroke-linecap="round"/>
     <path d="M256 343 q-26 22 -46 2" stroke="#5D4037" stroke-width="5" fill="none" stroke-linecap="round"/>
     <path d="M256 343 q26 22 46 2" stroke="#5D4037" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  ),

  fox: frame(
    '#FFF3E0',
    `<polygon points="152,150 110,18 218,108" fill="#EF6C00"/>
     <polygon points="360,150 402,18 294,108" fill="#EF6C00"/>
     <polygon points="160,128 138,68 196,112" fill="#3E2723"/>
     <polygon points="352,128 374,68 316,112" fill="#3E2723"/>
     <circle cx="256" cy="252" r="150" fill="#FB8C00"/>
     <polygon points="158,250 354,250 256,402" fill="#FFF8F0"/>
     ${eyes(206, 306, 236, 16)}
     <polygon points="256,318 240,336 272,336" fill="#2b2b2b"/>
     <path d="M256 336 v14" stroke="#5D4037" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  ),

  panda: frame(
    '#E0F7FA',
    `<circle cx="152" cy="142" r="56" fill="#2b2b2b"/>
     <circle cx="360" cy="142" r="56" fill="#2b2b2b"/>
     <circle cx="256" cy="272" r="152" fill="#ffffff"/>
     <ellipse cx="206" cy="252" rx="34" ry="46" fill="#2b2b2b"/>
     <ellipse cx="306" cy="252" rx="34" ry="46" fill="#2b2b2b"/>
     <circle cx="206" cy="258" r="14" fill="#ffffff"/>
     <circle cx="306" cy="258" r="14" fill="#ffffff"/>
     <ellipse cx="256" cy="320" rx="22" ry="15" fill="#2b2b2b"/>
     <path d="M256 335 q-22 22 -42 6" stroke="#2b2b2b" stroke-width="5" fill="none" stroke-linecap="round"/>
     <path d="M256 335 q22 22 42 6" stroke="#2b2b2b" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  ),

  rabbit: frame(
    '#F1F8E9',
    `<ellipse cx="214" cy="128" rx="34" ry="112" fill="#E6E6E6"/>
     <ellipse cx="298" cy="128" rx="34" ry="112" fill="#E6E6E6"/>
     <ellipse cx="214" cy="138" rx="16" ry="84" fill="#F8BBD0"/>
     <ellipse cx="298" cy="138" rx="16" ry="84" fill="#F8BBD0"/>
     <circle cx="256" cy="300" r="142" fill="#EFEFEF"/>
     ${eyes(212, 300, 290, 18)}
     <polygon points="256,318 242,334 270,334" fill="#F48FB1"/>
     <rect x="248" y="338" width="7" height="24" rx="2" fill="#ffffff" stroke="#C9C9C9" stroke-width="2"/>
     <rect x="257" y="338" width="7" height="24" rx="2" fill="#ffffff" stroke="#C9C9C9" stroke-width="2"/>`,
  ),

  bear: frame(
    '#EFEBE9',
    `<circle cx="158" cy="150" r="50" fill="#795548"/>
     <circle cx="354" cy="150" r="50" fill="#795548"/>
     <circle cx="158" cy="150" r="26" fill="#A1887F"/>
     <circle cx="354" cy="150" r="26" fill="#A1887F"/>
     <circle cx="256" cy="272" r="150" fill="#8D6E63"/>
     <ellipse cx="256" cy="322" rx="72" ry="56" fill="#D7CCC8"/>
     ${eyes(210, 302, 242, 16)}
     <ellipse cx="256" cy="302" rx="25" ry="17" fill="#2b2b2b"/>
     <path d="M256 319 v18" stroke="#5D4037" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  ),

  owl: frame(
    '#EDE7F6',
    `<polygon points="176,112 150,28 222,96" fill="#6D4C41"/>
     <polygon points="336,112 362,28 290,96" fill="#6D4C41"/>
     <ellipse cx="256" cy="284" rx="152" ry="160" fill="#8D6E63"/>
     <ellipse cx="256" cy="322" rx="96" ry="112" fill="#D7CCC8"/>
     <circle cx="205" cy="240" r="50" fill="#ffffff"/>
     <circle cx="307" cy="240" r="50" fill="#ffffff"/>
     <circle cx="205" cy="240" r="24" fill="#2b2b2b"/>
     <circle cx="307" cy="240" r="24" fill="#2b2b2b"/>
     <circle cx="197" cy="232" r="8" fill="#ffffff"/>
     <circle cx="299" cy="232" r="8" fill="#ffffff"/>
     <polygon points="256,266 238,298 274,298" fill="#F9A825"/>`,
  ),

  frog: frame(
    '#E8F5E9',
    `<circle cx="195" cy="150" r="56" fill="#66BB6A"/>
     <circle cx="317" cy="150" r="56" fill="#66BB6A"/>
     <circle cx="195" cy="146" r="34" fill="#ffffff"/>
     <circle cx="317" cy="146" r="34" fill="#ffffff"/>
     <circle cx="195" cy="150" r="18" fill="#2b2b2b"/>
     <circle cx="317" cy="150" r="18" fill="#2b2b2b"/>
     <ellipse cx="256" cy="300" rx="162" ry="132" fill="#66BB6A"/>
     <path d="M142 300 q114 92 232 0" stroke="#2E7D32" stroke-width="8" fill="none" stroke-linecap="round"/>
     <circle cx="238" cy="268" r="5" fill="#2E7D32"/>
     <circle cx="274" cy="268" r="5" fill="#2E7D32"/>`,
  ),
};

async function main() {
  const names = Object.keys(ANIMALS);

  for (const name of names) {
    const outPath = path.join(__dirname, `${name}.png`);
    execFileSync('rsvg-convert', ['-w', String(SIZE), '-h', String(SIZE), '-o', outPath], {
      input: ANIMALS[name],
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Generated ${names.length} animal PNG(s) in ${__dirname}: ${names.join(', ')}`);
}

main().catch((error) => {
  if (error?.code === 'ENOENT') {
    // eslint-disable-next-line no-console
    console.error('rsvg-convert was not found. Install librsvg (e.g. `brew install librsvg`).');
  } else {
    // eslint-disable-next-line no-console
    console.error(error);
  }
  process.exitCode = 1;
});
