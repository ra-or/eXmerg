import { describe, it, expect } from 'vitest';
import { getMergeStrategy } from './mergeStrategies.js';
import type { MergeMode } from 'shared';

describe('getMergeStrategy', () => {
  it('gibt Strategie für bekannte Modi zurück', () => {
    expect(getMergeStrategy('all_to_one_sheet' as MergeMode).mode).toBe('all_to_one_sheet');
    expect(getMergeStrategy('one_file_per_sheet' as MergeMode).mode).toBe('one_file_per_sheet');
    expect(getMergeStrategy('all_with_source_column' as MergeMode).mode).toBe('all_with_source_column');
  });

  it('wirft bei unbekanntem Modus', () => {
    expect(() => getMergeStrategy('unknown_mode' as MergeMode)).toThrow(/Unbekannter Merge-Modus/);
  });
});
