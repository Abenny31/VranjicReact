// Matches GalleryMediaValidation on the server; server signature validation remains authoritative.
export const MAXIMUM_MEDIA_BYTES = 20 * 1024 * 1024;
export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm';
const types: Record<string, 'Image' | 'Video'> = {
    'image/jpeg': 'Image', 'image/png': 'Image', 'image/gif': 'Image', 'image/webp': 'Image',
    'video/mp4': 'Video', 'video/webm': 'Video',
};
const extensions: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm' };

export function validateGalleryFile(file: File) {
    if (!file.size) throw new Error('Odabrana datoteka je prazna.');
    if (file.size > MAXIMUM_MEDIA_BYTES) throw new Error('Datoteka je prevelika. Najveća dopuštena veličina je 20 MiB.');
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const contentType = file.type.toLowerCase() || extensions[extension];
    if (['heic', 'heif'].includes(extension) || /image\/hei[cf]/i.test(contentType ?? '')) {
        throw new Error('HEIC/HEIF fotografije zasad nisu podržane. Izvezite fotografiju kao JPG ili u postavkama kamere odaberite kompatibilni format.');
    }
    const mediaType = types[contentType];
    if (!mediaType) throw new Error('Podržani su JPG, PNG, GIF, WebP, MP4 i WebM. Odaberite drugi format.');
    return { contentType, mediaType };
}

export function readMediaBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== 'string' || !reader.result.includes(',')) {
                reject(new Error('Datoteku nije moguće pročitati. Odaberite je ponovno.'));
                return;
            }
            resolve(reader.result.slice(reader.result.indexOf(',') + 1));
        };
        reader.onerror = () => reject(new Error('Datoteku nije moguće pročitati. Odaberite je ponovno.'));
        reader.onabort = () => reject(new Error('Čitanje datoteke je prekinuto. Odaberite je ponovno.'));
        reader.readAsDataURL(file);
    });
}
