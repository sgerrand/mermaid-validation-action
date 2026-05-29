export const KNOWN_DIAGRAM_TYPES = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'classDiagram-v2',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'quadrantChart',
  'requirement',
  'requirementDiagram',
  'gitGraph',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
  'sankey-beta',
  'xychart-beta',
  'block-beta',
  'packet-beta',
  'architecture-beta',
  'info',
  'radar-beta',
  'treemap-beta',
] as const;

export type KnownDiagramType = (typeof KNOWN_DIAGRAM_TYPES)[number];

const DIRECTIVE_RE = /^\s*%%\{.*\}%%\s*$/;
const COMMENT_RE = /^\s*%%[^{].*$/;
const YAML_FENCE = '---';

export function detectType(diagramText: string): string | null {
  const lines = diagramText.split(/\r?\n/);
  let i = 0;

  if (lines[i]?.trim() === YAML_FENCE) {
    i++;
    while (i < lines.length && lines[i]?.trim() !== YAML_FENCE) i++;
    if (i < lines.length) i++;
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (DIRECTIVE_RE.test(line)) continue;
    if (COMMENT_RE.test(line)) continue;

    const firstToken = trimmed.split(/\s+/)[0];
    if (!firstToken) continue;

    for (const type of KNOWN_DIAGRAM_TYPES) {
      if (firstToken === type) return type;
    }

    return null;
  }

  return null;
}
