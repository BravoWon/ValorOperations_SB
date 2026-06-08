/**
 * Export helpers for the live wellbore schematic.
 *
 * `serializeSvg` is pure/DOM-only and unit-tested in jsdom; `exportSvgToPng`
 * rasterizes via canvas (browser-only) and `printDiagram` uses the print path
 * for "Save as PDF" in slice 1.
 */

/** Serialize a live <svg> node to standalone XML markup (namespace-safe). */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}

/** Rasterize the live SVG to a PNG and trigger a download (canvas, browser-only). */
export async function exportSvgToPng(
  svg: SVGSVGElement,
  filename = 'wellbore.png',
  scale = 2,
): Promise<void> {
  const xml = serializeSvg(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = url;
  });
  const w = svg.viewBox.baseVal.width || svg.clientWidth || 800;
  const h = svg.viewBox.baseVal.height || svg.clientHeight || 1000;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0D1E35';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}

/** Open the browser print dialog (the slice-1 "Save as PDF" path). */
export function printDiagram(): void {
  window.print();
}
