// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from './Editor';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Marqueur SANS ambiguïté du contenu du calque de référence (data: URL) — s'il fuit dans un export,
 *  cette chaîne EXACTE s'y retrouve verbatim. */
const TRACE_MARKER = 'data:image/png;base64,PLANCHE-DE-LIVRE-SOUS-DROITS';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const el = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim().includes(label));
  if (!el) throw new Error(`bouton introuvable : « ${label} »`);
  return el as HTMLButtonElement;
}

/**
 * Charge un calque de référence FICTIF dans l'éditeur monté — `FileReader`/`Image` sont substitués
 * (surcharges PLATES, jamais `vi.mock`/`vi.spyOn` — cf. invariant de suite `isolate:false`,
 * `vite.config.ts`) car jsdom ne décode aucune ressource `data:` par défaut : sans ça, `img.onload`
 * ne se déclenche jamais et le calque resterait indéfiniment « en cours de chargement ».
 */
async function loadFakeTraceLayer(container: HTMLElement) {
  const OrigFileReader = globalThis.FileReader;
  const OrigImage = globalThis.Image;
  class FakeFileReader {
    onload: (() => void) | null = null;
    result: string | ArrayBuffer | null = null;
    readAsDataURL() {
      this.result = TRACE_MARKER;
      queueMicrotask(() => this.onload?.());
    }
  }
  class FakeImage {
    onload: (() => void) | null = null;
    naturalWidth = 800;
    naturalHeight = 600;
    set src(_v: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  (globalThis as unknown as { FileReader: unknown }).FileReader = FakeFileReader;
  (globalThis as unknown as { Image: unknown }).Image = FakeImage;
  try {
    const input = container.querySelector('.trace-layer-panel input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'planche.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      await flush();
    });
  } finally {
    (globalThis as unknown as { FileReader: unknown }).FileReader = OrigFileReader;
    (globalThis as unknown as { Image: unknown }).Image = OrigImage;
  }
}

describe('calque de référence — ABSENT de tout export (#830)', () => {
  it("le calque chargé n'apparaît ni dans l'export JSON, ni dans l'export ASCII", async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor />);
    });

    await loadFakeTraceLayer(container);
    // Preuve que le calque est bien chargé (sinon le test ne prouverait rien) : le panneau bascule
    // en mode « calque présent » (bouton de calibration visible).
    expect(() => button(container, 'Calibrer 2 points')).not.toThrow();

    // --- Export JSON : intercepte le Blob écrit par `downloadText` (surcharges PLATES, restaurées). ---
    const OrigBlob = globalThis.Blob;
    const OrigCreateObjectURL = URL.createObjectURL;
    const OrigRevokeObjectURL = URL.revokeObjectURL;
    let lastBlobText = '';
    class CapturingBlob extends OrigBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        lastBlobText = parts.map((p) => String(p)).join('');
      }
    }
    (globalThis as unknown as { Blob: unknown }).Blob = CapturingBlob;
    URL.createObjectURL = () => 'blob:fake';
    URL.revokeObjectURL = () => {};
    try {
      await act(async () => {
        button(container, 'Fichier').click();
      });
      await act(async () => {
        button(container, 'Exporter JSON').click();
      });
    } finally {
      (globalThis as unknown as { Blob: unknown }).Blob = OrigBlob;
      URL.createObjectURL = OrigCreateObjectURL;
      URL.revokeObjectURL = OrigRevokeObjectURL;
    }
    expect(lastBlobText.length).toBeGreaterThan(0); // preuve que l'export a bien produit un contenu
    expect(lastBlobText).not.toContain(TRACE_MARKER);
    expect(lastBlobText).not.toContain('traceLayer');
    expect(lastBlobText).not.toContain('imageDataUrl');

    // --- Export ASCII : modale affichant le texte, jamais téléchargé via Blob. ---
    await act(async () => {
      button(container, 'Fichier').click();
    });
    await act(async () => {
      button(container, "Exporter ASCII").click();
    });
    const textarea = container.querySelector('textarea.json-editor') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.value).not.toContain(TRACE_MARKER);
    expect(textarea.value).not.toContain('traceLayer');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
