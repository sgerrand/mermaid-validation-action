import { Window } from 'happy-dom';

let installed = false;

export function setupDom(): void {
  if (installed) return;
  installed = true;

  const win = new Window({ url: 'http://localhost/' });
  const doc = win.document;

  const g = globalThis as unknown as Record<string, unknown>;

  const assign = (key: string, value: unknown): void => {
    try {
      g[key] = value;
    } catch {
      // Property is non-writable on this Node version (e.g. navigator on Node 21+).
      // The host's built-in value is fine for mermaid's purposes.
    }
  };

  assign('window', win);
  assign('document', doc);
  assign('navigator', win.navigator);
  assign('HTMLElement', win.HTMLElement);
  assign('Element', win.Element);
  assign('Node', win.Node);
  assign('SVGElement', win.SVGElement);
  assign('DOMParser', win.DOMParser);
  assign('XMLSerializer', win.XMLSerializer);
  assign('getComputedStyle', win.getComputedStyle.bind(win));

  if (typeof g.requestAnimationFrame !== 'function') {
    assign('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      return setTimeout(() => cb(Date.now()), 0) as unknown as number;
    });
    assign('cancelAnimationFrame', (id: number): void => {
      clearTimeout(id);
    });
  }
}
