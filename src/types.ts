export interface Failure {
  file: string;
  line: number;
  column?: number;
  message: string;
  diagramType?: string;
  severity: 'error' | 'warning';
}

export interface ValidationStats {
  fileCount: number;
  blockCount: number;
  errorCount: number;
  warningCount: number;
}
