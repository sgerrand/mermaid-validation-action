import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Code } from 'mdast';

export interface MermaidBlock {
  file: string;
  value: string;
  startLine: number;
  endLine: number;
  lang: string;
}

const processor = unified().use(remarkParse);

export function extractBlocks(file: string, source: string): MermaidBlock[] {
  const tree = processor.parse(source) as Root;
  const blocks: MermaidBlock[] = [];

  visit(tree, 'code', (node: Code) => {
    const lang = (node.lang ?? '').trim().toLowerCase();
    if (lang !== 'mermaid') return;
    if (!node.position) return;

    blocks.push({
      file,
      value: node.value,
      startLine: node.position.start.line,
      endLine: node.position.end.line,
      lang,
    });
  });

  return blocks;
}
