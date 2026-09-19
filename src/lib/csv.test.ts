import { describe, expect, it } from 'vitest';
import { encodeCsv, escapeCsvCell } from './csv';

describe('encodeCsv', () => {
  it('échappe les guillemets et gère le point-virgule', () => {
    expect(escapeCsvCell('simple')).toBe('simple');
    expect(escapeCsvCell('avec;virgule')).toBe('"avec;virgule"');
    expect(escapeCsvCell('avec "guillemets"')).toBe('"avec ""guillemets"""');
    expect(escapeCsvCell('ligne\nsaut')).toBe('"ligne\nsaut"');
  });

  it('nombres en décimale fr', () => {
    expect(escapeCsvCell(45.9)).toBe('45,9');
    expect(escapeCsvCell(12500)).toBe('12500');
  });

  it('null/undefined → vide', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('encode en-têtes + lignes avec BOM et CRLF', () => {
    const csv = encodeCsv(['A', 'B'], [[1, 'x'], [2, 'y;z']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('A;B\r\n1;x\r\n2;"y;z"');
  });
});
