import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cssStyles = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');

function extractTokens(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cssStyles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  if (!match) return {};
  const block = match[1];
  const entries = [];
  for (const m of block.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6})/gi)) {
    entries.push([m[1], m[2]]);
  }
  return Object.fromEntries(entries);
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test('light and dark theme core text pairs meet WCAG AA contrast standards (>= 4.5:1)', () => {
  const lightTokens = extractTokens(':root');
  const darkTokens = extractTokens("[data-theme='dark']");

  const lightPairs = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['muted', 'surface'],
    ['muted', 'bg'],
    ['primary-text', 'primary'],
  ];
  const darkPairs = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['muted', 'surface'],
    ['muted', 'bg'],
    ['primary-text', 'primary'],
  ];

  lightPairs.forEach(([fg, bg]) => {
    assert.ok(
      contrastRatio(lightTokens[fg], lightTokens[bg]) >= 4.5,
      `Light ${fg} on ${bg} must be at least 4.5:1`
    );
  });

  darkPairs.forEach(([fg, bg]) => {
    assert.ok(
      contrastRatio(darkTokens[fg], darkTokens[bg]) >= 4.5,
      `Dark ${fg} on ${bg} must be at least 4.5:1`
    );
  });
});
