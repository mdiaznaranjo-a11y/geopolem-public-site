// Low-poly editorial world map (not topographically precise).
// Coordinates use a 1000 x 500 equirectangular grid (lng -180..180, lat 90..-90).
// Continents are stylized polygons for the situation-room aesthetic.

export const MAP_W = 1000;
export const MAP_H = 500;

// Convert lng/lat to viewBox coords (equirectangular)
export function project(lng, lat) {
  const x = ((lng + 180) / 360) * MAP_W;
  const y = ((90 - lat) / 180) * MAP_H;
  return [x, y];
}

// Stylized continent paths (hand-tuned low poly)
export const CONTINENTS = [
  // North America
  { id:'na', d:`M 80,80 L 150,70 L 220,75 L 270,90 L 290,120 L 310,150 L 290,180 L 250,205 L 220,225 L 200,250 L 180,235 L 165,210 L 150,200 L 130,210 L 115,200 L 95,180 L 85,150 L 78,115 Z
                 M 310,200 L 330,205 L 350,220 L 345,245 L 320,250 L 305,235 Z` },
  // Greenland
  { id:'gr', d:`M 360,60 L 420,55 L 440,90 L 425,120 L 395,128 L 375,108 L 365,85 Z` },
  // South America
  { id:'sa', d:`M 270,270 L 305,265 L 335,285 L 348,320 L 345,360 L 330,400 L 305,430 L 285,455 L 268,440 L 258,400 L 250,360 L 252,320 L 260,290 Z` },
  // Europe
  { id:'eu', d:`M 470,110 L 510,100 L 545,108 L 560,120 L 580,115 L 600,125 L 595,150 L 575,160 L 555,165 L 525,170 L 495,160 L 475,145 L 460,130 Z` },
  // Africa
  { id:'af', d:`M 490,180 L 540,175 L 585,180 L 615,205 L 625,250 L 615,300 L 595,340 L 565,365 L 540,360 L 515,335 L 495,300 L 485,260 L 480,220 Z` },
  // Middle East (separate small mass for emphasis)
  { id:'me', d:`M 595,170 L 625,170 L 650,185 L 660,205 L 645,225 L 620,225 L 605,210 L 598,190 Z` },
  // Asia (large)
  { id:'as', d:`M 615,90 L 690,80 L 760,85 L 820,95 L 860,105 L 880,125 L 870,150 L 850,170 L 825,185 L 800,195 L 770,200 L 740,205 L 710,210 L 685,215 L 665,205 L 650,185 L 635,170 L 620,150 L 615,120 Z
                 M 700,215 L 740,215 L 770,225 L 780,250 L 760,265 L 730,260 L 710,245 L 700,230 Z
                 M 830,200 L 870,210 L 880,235 L 860,255 L 835,245 L 825,225 Z` },
  // India subcontinent
  { id:'in', d:`M 735,200 L 770,200 L 780,225 L 765,255 L 745,250 L 735,230 Z` },
  // Southeast Asia / Indonesia (archipelago)
  { id:'se', d:`M 820,260 L 850,265 L 870,275 L 855,290 L 825,285 L 815,275 Z
                 M 870,280 L 895,283 L 905,295 L 885,300 L 870,295 Z` },
  // Australia
  { id:'au', d:`M 855,360 L 905,355 L 935,370 L 945,395 L 920,415 L 880,415 L 855,400 L 845,380 Z` },
  // New Zealand
  { id:'nz', d:`M 955,420 L 970,418 L 975,435 L 962,448 L 950,440 Z` },
  // UK / Ireland
  { id:'uk', d:`M 470,115 L 485,110 L 488,130 L 478,138 L 470,132 Z` },
  // Japan
  { id:'jp', d:`M 875,170 L 895,168 L 902,188 L 890,200 L 880,195 Z` },
  // Antarctica strip
  { id:'aa', d:`M 60,475 L 200,470 L 400,470 L 600,470 L 800,470 L 940,475 L 940,498 L 60,498 Z` },
];
