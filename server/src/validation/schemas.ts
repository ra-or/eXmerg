import path from 'path';
import { z } from 'zod';

const mergeModeSchema = z.enum([
  'all_to_one_sheet',
  'one_file_per_sheet',
  'all_with_source_column',
  'consolidated_sheets',
  'row_per_file',
  'row_per_file_no_sum',
]);

const sheetSelectionModeSchema = z.enum(['all', 'first']);

const sheetNameFilterSchema = z.object({
  mode: z.enum(['include', 'exclude']),
  values: z.array(z.string()),
  match: z.enum(['exact', 'contains', 'regex']).optional(),
  caseSensitive: z.boolean().optional(),
});

/** Schema für Merge-Optionen (Body von POST /api/merge). */
export const mergeOptionsSchema = z.object({
  outputType: z.literal('xlsx'),
  mode: mergeModeSchema,
  selectedSheets: z.record(z.string(), z.array(z.string())).optional(),
  sheetSelectionMode: sheetSelectionModeSchema.optional(),
  sheetNameFilter: sheetNameFilterSchema.optional(),
  outputFormat: z.enum(['xlsx', 'ods']).optional(),
  customSheetNames: z.record(z.string(), z.record(z.string(), z.string())).optional(),
});

export type MergeOptionsInput = z.infer<typeof mergeOptionsSchema>;

/** Schema für Download-Query (GET /api/download). */
export const downloadQuerySchema = z.object({
  id: z.string().min(1).refine((v) => !v.includes('..') && !path.isAbsolute(v), {
    message: 'Parameter id ungültig.',
  }),
  name: z.string().optional(),
  subdir: z.string().optional().refine(
    (v) => v === undefined || (!v.includes('..') && !path.isAbsolute(v)),
    { message: 'Parameter subdir ungültig.' }
  ),
  fmt: z.string().optional(),
});

export type DownloadQueryInput = z.infer<typeof downloadQuerySchema>;
