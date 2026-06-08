import { describe, it, expect } from 'vitest';
import { serializeSvg } from '@/lib/export-diagram';

describe('serializeSvg', () => {
  it('wraps svg markup with xml namespace', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '10');
    svg.setAttribute('height', '10');
    const out = serializeSvg(svg);
    expect(out).toContain('<svg');
    expect(out).toContain('xmlns');
  });
});
