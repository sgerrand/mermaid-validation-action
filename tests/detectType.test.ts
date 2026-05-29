import { describe, it, expect } from 'bun:test';
import { detectType, KNOWN_DIAGRAM_TYPES } from '../src/detectType';

describe('detectType', () => {
  it('detects flowchart', () => {
    expect(detectType('flowchart TD\n  A --> B')).toBe('flowchart');
  });

  it('detects graph', () => {
    expect(detectType('graph LR\n  A --> B')).toBe('graph');
  });

  it('detects sequenceDiagram', () => {
    expect(detectType('sequenceDiagram\n  A->>B: Hi')).toBe('sequenceDiagram');
  });

  it('detects every known type from its prefix line', () => {
    for (const type of KNOWN_DIAGRAM_TYPES) {
      expect(detectType(`${type}\n  rest`)).toBe(type);
    }
  });

  it('skips leading blank lines', () => {
    expect(detectType('\n\n  flowchart TD\n  A --> B')).toBe('flowchart');
  });

  it('skips %%{init: ...}%% directives', () => {
    const txt = '%%{init: {"theme": "dark"}}%%\nflowchart TD\nA --> B';
    expect(detectType(txt)).toBe('flowchart');
  });

  it('skips %% comments', () => {
    const txt = '%% this is a comment\nflowchart TD\nA --> B';
    expect(detectType(txt)).toBe('flowchart');
  });

  it('skips YAML frontmatter block', () => {
    const txt =
      '---\ntitle: My diagram\nconfig:\n  theme: dark\n---\nflowchart TD\nA --> B';
    expect(detectType(txt)).toBe('flowchart');
  });

  it('returns null for unknown first token', () => {
    expect(detectType('flochart TD\nA --> B')).toBeNull();
  });

  it('returns null for entirely empty input', () => {
    expect(detectType('')).toBeNull();
  });

  it('returns null when only blank lines and directives', () => {
    expect(detectType('\n\n%%{init: {}}%%\n%% comment\n')).toBeNull();
  });

  it('matches first whitespace-separated token, not substring', () => {
    expect(detectType('flowchartTD\nA --> B')).toBeNull();
  });
});
