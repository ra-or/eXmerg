import { describe, it, expect } from 'vitest';
import { mergeOptionsSchema, downloadQuerySchema } from './schemas.js';

describe('mergeOptionsSchema', () => {
  it('akzeptiert gültige Merge-Optionen', () => {
    const valid = { outputType: 'xlsx', mode: 'one_file_per_sheet' };
    expect(mergeOptionsSchema.safeParse(valid).success).toBe(true);
  });

  it('lehnt ungültigen Modus ab', () => {
    const invalid = { outputType: 'xlsx', mode: 'invalid_mode' };
    expect(mergeOptionsSchema.safeParse(invalid).success).toBe(false);
  });

  it('lehnt fehlendes outputType ab', () => {
    const invalid = { mode: 'one_file_per_sheet' };
    expect(mergeOptionsSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('downloadQuerySchema', () => {
  it('akzeptiert gültige Query (id)', () => {
    expect(downloadQuerySchema.safeParse({ id: 'abc123.xlsx' }).success).toBe(true);
  });

  it('lehnt leere id ab', () => {
    expect(downloadQuerySchema.safeParse({ id: '' }).success).toBe(false);
  });

  it('lehnt id mit .. ab', () => {
    expect(downloadQuerySchema.safeParse({ id: '../etc/passwd' }).success).toBe(false);
  });
});
