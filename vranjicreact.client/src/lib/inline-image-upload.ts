import { readMediaBase64, validateGalleryFile } from './gallery-upload';

export interface InlineImageUpload { contentType: string; base64Data: string }
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp';

export function validateInlineImage(file: File) {
    const result = validateGalleryFile(file);
    if (result.mediaType !== 'Image') throw new Error('Odaberite fotografiju, a ne video.');
    return result;
}

export async function prepareImageUpload(file: File | null): Promise<InlineImageUpload | undefined> {
    if (!file) return undefined;
    const { contentType } = validateInlineImage(file);
    return { contentType, base64Data: await readMediaBase64(file) };
}
