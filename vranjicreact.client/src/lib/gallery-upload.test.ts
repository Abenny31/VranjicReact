import { describe, expect, it } from 'vitest';
import { MAXIMUM_MEDIA_BYTES, readMediaBase64, validateGalleryFile } from './gallery-upload';

describe('Gallery file selection', () => {
    it('recognizes supported files even when a mobile picker omits the MIME type', async () => {
        const file = new File(['test'], 'photo.JPG');
        expect(validateGalleryFile(file)).toEqual({ contentType: 'image/jpeg', mediaType: 'Image' });
        expect(await readMediaBase64(file)).toBe('dGVzdA==');
        expect(validateGalleryFile(new File(['test'], 'clip.mp4', { type: 'video/mp4' })).mediaType).toBe('Video');
    });
    it('rejects HEIC, empty and unsupported files with actionable errors', () => {
        expect(() => validateGalleryFile(new File(['test'], 'photo.heic', { type: 'image/heic' }))).toThrow(/HEIC.*JPG/);
        expect(() => validateGalleryFile(new File([], 'photo.jpg'))).toThrow(/prazna/);
        expect(() => validateGalleryFile(new File(['test'], 'drawing.svg', { type: 'image/svg+xml' }))).toThrow(/Podržani/);
        expect(() => validateGalleryFile(new File(['test'], 'renamed.jpg', { type: 'text/html' }))).toThrow(/Podržani/);
    });
    it('rejects oversized media before creating a base64 copy', () => {
        const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
        Object.defineProperty(file, 'size', { value: MAXIMUM_MEDIA_BYTES + 1 });
        expect(() => validateGalleryFile(file)).toThrow(/20 MiB/);
    });
});
