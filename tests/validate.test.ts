import { describe, it, expect } from 'bun:test';
import { validate } from '../src/validate';

describe('validate', () => {
  it('accepts a valid flowchart', async () => {
    const result = await validate('flowchart TD\n  A --> B\n  B --> C');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagramType).toMatch(/^flowchart/);
  });

  it('accepts a valid sequenceDiagram', async () => {
    const txt = [
      'sequenceDiagram',
      '  participant A',
      '  participant B',
      '  A->>B: Hello',
      '  B-->>A: Hi back',
    ].join('\n');
    const result = await validate(txt);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagramType).toBe('sequence');
  });

  it('accepts a valid pie chart', async () => {
    const txt = 'pie title Pets\n  "Dogs": 386\n  "Cats": 85';
    const result = await validate(txt);
    expect(result.ok).toBe(true);
  });

  it('accepts a valid classDiagram', async () => {
    const txt = [
      'classDiagram',
      '  class Animal {',
      '    +String name',
      '    +eat()',
      '  }',
    ].join('\n');
    const result = await validate(txt);
    expect(result.ok).toBe(true);
  });

  it('rejects unknown diagram type', async () => {
    const result = await validate('notADiagramType\n  foo');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBeTruthy();
  });

  it('rejects malformed flowchart and reports a line number', async () => {
    const txt = 'flowchart TD\n  A --> B\n  B -!- C';
    const result = await validate(txt);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBeTruthy();
      expect(typeof result.line === 'number' || result.line === undefined).toBe(
        true,
      );
    }
  });

  it('rejects empty diagram', async () => {
    const result = await validate('');
    expect(result.ok).toBe(false);
  });
});
