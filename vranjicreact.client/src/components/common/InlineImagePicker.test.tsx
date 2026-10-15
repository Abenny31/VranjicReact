import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { MAXIMUM_MEDIA_BYTES } from '@/lib/gallery-upload';
import { prepareImageUpload } from '@/lib/inline-image-upload';
import InlineImagePicker from './InlineImagePicker';

it('rejects HEIC, video, oversized and empty photos without losing the selected photo', () => {
    const onChange = vi.fn();
    render(<LanguageProvider><InlineImagePicker file={null} onChange={onChange} /></LanguageProvider>);
    const input = screen.getByLabelText('Odaberi fotografiju s uređaja');
    const large = new File(['small'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(large, 'size', { value: MAXIMUM_MEDIA_BYTES + 1 });
    for (const file of [new File(['photo'], 'photo.heic', { type: 'image/heic' }),
        new File(['video'], 'video.mp4', { type: 'video/mp4' }), large, new File([], 'empty.jpg', { type: 'image/jpeg' })]) {
        fireEvent.change(input, { target: { files: [file] } });
        expect(screen.getByRole('alert')).toBeInTheDocument();
    }
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('keeps uploads optional and encodes a supported photo on save', async () => {
    expect(await prepareImageUpload(null)).toBeUndefined();
    expect(await prepareImageUpload(new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })))
        .toEqual({ contentType: 'image/jpeg', base64Data: 'cGhvdG8=' });
});
