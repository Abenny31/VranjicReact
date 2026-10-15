import { useId, useState, type InputHTMLAttributes } from 'react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { useUiTranslation } from '@/hooks/useUiTranslation';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

export default function PasswordField({ label, id, className = '', disabled, ...inputProps }: PasswordFieldProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    const { ui } = useUiTranslation();
    const Icon = visible ? IconEyeOff : IconEye;

    return <div className="text-sm">
        <label htmlFor={inputId} className="block font-semibold text-slate-600">{label}</label>
        <div className="relative mt-1">
            <input {...inputProps} id={inputId} disabled={disabled} type={visible ? 'text' : 'password'}
                className={`w-full rounded border border-slate-300 p-2 pr-12 focus:border-blue-500 focus:outline-none ${className}`} />
            <button type="button" disabled={disabled} onClick={() => setVisible(value => !value)}
                aria-controls={inputId} aria-pressed={visible}
                aria-label={`${ui(visible ? 'Sakrij lozinku' : 'Prikaži lozinku')}: ${label}`}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50">
                <Icon size={20} aria-hidden="true" />
            </button>
        </div>
    </div>;
}
