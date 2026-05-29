import { describe, it, expect } from 'bun:test';
import { extractBlocks } from '../src/extractBlocks';

describe('extractBlocks', () => {
  it('returns empty array for markdown with no fences', () => {
    const md = '# Title\n\nNo diagrams here.\n';
    expect(extractBlocks('a.md', md)).toEqual([]);
  });

  it('returns empty array for non-mermaid code fences', () => {
    const md = '```js\nconst x = 1;\n```\n';
    expect(extractBlocks('a.md', md)).toEqual([]);
  });

  it('extracts a single mermaid block with start/end lines', () => {
    const md = [
      '# Doc',
      '',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```',
      '',
      'After.',
      '',
    ].join('\n');

    const blocks = extractBlocks('doc.md', md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      file: 'doc.md',
      lang: 'mermaid',
      value: 'flowchart TD\n  A --> B',
      startLine: 3,
      endLine: 6,
    });
  });

  it('extracts multiple mermaid blocks in order', () => {
    const md = [
      '```mermaid',
      'flowchart TD',
      'A-->B',
      '```',
      '',
      'mid',
      '',
      '```mermaid',
      'sequenceDiagram',
      'A->>B: Hi',
      '```',
    ].join('\n');

    const blocks = extractBlocks('x.md', md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.value.startsWith('flowchart')).toBe(true);
    expect(blocks[1]?.value.startsWith('sequenceDiagram')).toBe(true);
  });

  it('treats language tag case-insensitively', () => {
    const md = '```Mermaid\npie\n  "a": 1\n```\n';
    expect(extractBlocks('x.md', md)).toHaveLength(1);
  });

  it('ignores indented code blocks without language tag', () => {
    const md = '    flowchart TD\n    A --> B\n';
    expect(extractBlocks('x.md', md)).toEqual([]);
  });

  it('handles four-backtick fences', () => {
    const md = '````mermaid\nflowchart TD\nA --> B\n````\n';
    expect(extractBlocks('x.md', md)).toHaveLength(1);
  });

  it('handles trailing newline absence', () => {
    const md = '```mermaid\npie\n  "a": 1\n```';
    const blocks = extractBlocks('x.md', md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.value).toBe('pie\n  "a": 1');
  });

  it('handles empty mermaid block', () => {
    const md = '```mermaid\n```\n';
    const blocks = extractBlocks('x.md', md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.value).toBe('');
  });
});
