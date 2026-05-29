import { setupDom } from './setupDom.js';

export interface ValidateOk {
  ok: true;
  diagramType: string;
}

export interface ValidateError {
  ok: false;
  message: string;
  line?: number;
  column?: number;
  diagramType?: string;
}

export type ValidateResult = ValidateOk | ValidateError;

let mermaidInstance: typeof import('mermaid').default | null = null;

async function getMermaid(): Promise<typeof import('mermaid').default> {
  if (mermaidInstance) return mermaidInstance;
  setupDom();
  const mod = await import('mermaid');
  const mermaid = mod.default;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  mermaidInstance = mermaid;
  return mermaid;
}

const LINE_PATTERNS: RegExp[] = [
  /Parse error on line (\d+)/i,
  /\bline (\d+)\b/i,
  /at line (\d+)/i,
];

function extractLine(message: string): number | undefined {
  for (const re of LINE_PATTERNS) {
    const m = message.match(re);
    if (m && m[1]) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}

interface MermaidHashError extends Error {
  hash?: { line?: number; loc?: { first_column?: number } };
  str?: string;
}

function extractFromHash(err: unknown): { line?: number; column?: number } {
  if (!err || typeof err !== 'object') return {};
  const hashed = err as MermaidHashError;
  const line =
    typeof hashed.hash?.line === 'number' ? hashed.hash.line + 1 : undefined;
  const column = hashed.hash?.loc?.first_column;
  return { line, column };
}

export async function validate(diagramText: string): Promise<ValidateResult> {
  const mermaid = await getMermaid();
  try {
    const result = await mermaid.parse(diagramText);
    return { ok: true, diagramType: result.diagramType };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const hashLoc = extractFromHash(err);
    const line = hashLoc.line ?? extractLine(message);
    const column = hashLoc.column;
    return { ok: false, message, line, column };
  }
}
