type EventColors = { accent: string; background: string; border: string; text: string };
type RGB = [number, number, number];

// Preserve the original visual theme when using its seed colors, even after renaming categories.
const ORIGINAL_COLORS: Record<string, EventColors> = {
  '#8662d9': { accent: '#9170da', background: '#eeebfb', border: '#dfd8f3', text: '#654c91' },
  '#4387d5': { accent: '#5893db', background: '#e7f0fc', border: '#d4e4f7', text: '#38608c' },
  '#cf9027': { accent: '#d6a447', background: '#fbf2df', border: '#f0e3c4', text: '#896b31' },
  '#788495': { accent: '#8995a7', background: '#edf0f4', border: '#dfe4eb', text: '#586576' },
  '#5a9b64': { accent: '#7cab74', background: '#eaf3e9', border: '#d7e8d7', text: '#51754e' },
};

function hex(rgb: RGB) { return '#' + rgb.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join(''); }
function luminance(rgb: RGB) {
  const linear = rgb.map(channel => { const value = Math.round(channel) / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function eventColors(color: string): EventColors {
  const normalized = color.toLowerCase();
  if (ORIGINAL_COLORS[normalized]) return ORIGINAL_COLORS[normalized];
  const rgb = [1, 3, 5].map(offset => parseInt(normalized.slice(offset, offset + 2), 16)) as RGB;
  const background = rgb.map(channel => channel * 0.12 + 255 * 0.88) as RGB;
  const border = rgb.map(channel => channel * 0.28 + 255 * 0.72) as RGB;
  let text = rgb.map(channel => channel * 0.75) as RGB;
  // Custom light colors still get a readable, darker version of the same hue.
  while ((luminance(background) + 0.05) / (luminance(text) + 0.05) < 4.5) {
    text = text.map(channel => channel * 0.9) as RGB;
  }
  return { accent: normalized, background: hex(background), border: hex(border), text: hex(text) };
}
