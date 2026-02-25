import { describe, it, expect } from 'vitest';
import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = createApp();

const FIXTURES_DIR = path.join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'files');
const TEST_FILE = path.join(FIXTURES_DIR, 'cities_north.xlsx');

describe('API Routes', () => {
  describe('GET /api/health', () => {
    it('returns 200 ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.text).toBe('ok');
    });
  });

  describe('POST /api/upload-file', () => {
    it('uploads a valid xlsx file and returns fileId', async () => {
      const res = await request(app).post('/api/upload-file').attach('file', TEST_FILE);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('fileId');
      expect(res.body).toHaveProperty('filename', 'cities_north.xlsx');
      expect(res.body.fileId).toMatch(/\.xlsx$/);
    });

    it('returns 400 when no file is provided', async () => {
      const res = await request(app).post('/api/upload-file');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/sheets', () => {
    it('returns sheet info for an uploaded file', async () => {
      const res = await request(app).post('/api/sheets').attach('file', TEST_FILE);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sheets');
      expect(res.body.sheets.length).toBeGreaterThan(0);
      expect(res.body.sheets[0]).toHaveProperty('name', 'Daten');
    });

    it('returns 400 when no file is provided', async () => {
      const res = await request(app).post('/api/sheets');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/merge', () => {
    it('merges two pre-uploaded files and returns download info', async () => {
      const file1Path = path.join(FIXTURES_DIR, 'cities_north.xlsx');
      const file2Path = path.join(FIXTURES_DIR, 'cities_south.xlsx');

      // Upload both files first
      const upload1 = await request(app).post('/api/upload-file').attach('file', file1Path);
      const upload2 = await request(app).post('/api/upload-file').attach('file', file2Path);
      expect(upload1.status).toBe(200);
      expect(upload2.status).toBe(200);

      const fileIds = [upload1.body.fileId, upload2.body.fileId];
      const fileNames = ['cities_north.xlsx', 'cities_south.xlsx'];

      const mergeOptions = {
        outputType: 'xlsx',
        mode: 'all_to_one_sheet',
      };

      const res = await request(app)
        .post('/api/merge')
        .field('options', JSON.stringify(mergeOptions))
        .field('fileIds', JSON.stringify(fileIds))
        .field('fileNames', JSON.stringify(fileNames))
        .field('filename', 'test_merged.xlsx');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('mergeId');
    });

    it('returns 400 when options are missing', async () => {
      const res = await request(app).post('/api/merge');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/download', () => {
    it('returns 400 for missing id parameter', async () => {
      const res = await request(app).get('/api/download');
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent file', async () => {
      const res = await request(app).get('/api/download').query({ id: 'nonexistent.xlsx' });
      expect(res.status).toBe(404);
    });
  });
});
