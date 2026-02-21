import { describe, it, expect } from 'vitest';
import { getDownloadUrl } from './client';

describe('getDownloadUrl', () => {
  it('hängt API_BASE vor den Pfad', () => {
    expect(getDownloadUrl('/download/abc')).toBe('/api/download/abc');
    expect(getDownloadUrl('/merge/123/result.xlsx')).toBe('/api/merge/123/result.xlsx');
  });
});
