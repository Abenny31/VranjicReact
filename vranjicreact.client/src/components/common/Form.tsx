'use client';

import { FormEvent, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { FormProps } from '../../shared/types';

const Form = ({
  title,
  description,
  disabled,
  inputs,
  radioBtns,
  textarea,
  checkboxes,
  btn,
  btnPosition,
  containerClass,
  onSubmit,
}: FormProps) => {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [radioBtnValue, setRadioBtnValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [checkedState, setCheckedState] = useState<boolean[]>(() => new Array(checkboxes?.length ?? 0).fill(false));

  useEffect(() => {
    setCheckedState(new Array(checkboxes?.length ?? 0).fill(false));
  }, [checkboxes?.length]);

  const changeInputValueHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, id, value } = event.target;

    setInputValues(prev => {
      const key = name ?? id ?? `input-${Object.keys(prev).length}`;
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  const changeRadioBtnsHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRadioBtnValue(event.target.value);
  };

  const changeTextareaHandler = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextareaValue(event.target.value);
  };

  const changeCheckboxHandler = (index: number) => {
    setCheckedState(prevValues => {
      const updated = [...(prevValues ?? [])];
      updated[index] = !updated[index];
      return updated;
    });
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    if (typeof onSubmit === 'function') {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const values = Object.fromEntries(formData.entries());
      const reset = () => {
        form.reset();
        setInputValues({});
        setRadioBtnValue('');
        setTextareaValue('');
        setCheckedState(new Array(checkboxes?.length ?? 0).fill(false));
      };

      await onSubmit(values, { reset });
    }
  };

  return (
    <form id="contactForm" className={twMerge('', containerClass)} onSubmit={handleFormSubmit} noValidate>
      {title && <h2 className={`${description ? 'mb-2' : 'mb-4'} text-2xl font-bold`}>{title}</h2>}
      {description && <p className="mb-4">{description}</p>}
      <fieldset disabled={disabled} aria-disabled={disabled} className={disabled ? 'opacity-60' : ''}>
        <div className="mb-6">
          {/* Inputs */}
          <div className="mx-0 mb-1 sm:mb-4">
            {inputs?.map(({ type, label, name, autocomplete, placeholder }, index) => {
              const key = name ?? `input-${index}`;
              return (
                <div key={`item-input-${index}`} className="mx-0 mb-1 sm:mb-4">
                  <label htmlFor={name ?? key} className="pb-1 text-xs uppercase tracking-wider">
                    {label}
                  </label>
                  <input
                    type={type}
                    id={name ?? key}
                    name={name ?? key}
                    autoComplete={autocomplete}
                    value={inputValues[name ?? key] ?? ''}
                    onChange={changeInputValueHandler}
                    placeholder={placeholder}
                    className="mb-2 w-full rounded-md border border-gray-400 py-2 pl-2 pr-4 shadow-md dark:text-gray-300 sm:mb-0"
                  />
                </div>
              );
            })}
          </div>
          {/* Radio buttons */}
          {radioBtns && (
            <div className="mx-0 mb-1 sm:mb-3">
              <span className="pb-1 text-xs uppercase tracking-wider">{radioBtns?.label}</span>
              <div className="flex flex-wrap">
                {radioBtns.radios.map(({ label, value }, index) => (
                  <div key={`radio-btn-${index}`} className="mr-4 items-baseline">
                    <input
                      id={label}
                      type="radio"
                      name={radioBtns.name || radioBtns.label || 'radio-group'}
                      value={value ?? `value${index}`}
                      checked={radioBtnValue === (value ?? `value${index}`)}
                      onChange={changeRadioBtnsHandler}
                      className="cursor-pointer"
                    />
                    <label htmlFor={label} className="ml-2">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Textarea */}
          {textarea && (
            <div className={`mx-0 mb-1 sm:mb-4`}>
              <label htmlFor={textarea.name} className="pb-1 text-xs uppercase tracking-wider">
                {textarea.label}
              </label>
              <textarea
                id={textarea.name}
                name={textarea.name}
                cols={textarea.cols}
                rows={textarea.rows}
                value={textareaValue}
                onChange={changeTextareaHandler}
                placeholder={textarea.placeholder}
                className="mb-2 w-full rounded-md border border-gray-400 py-2 pl-2 pr-4 shadow-md dark:text-gray-300 sm:mb-0"
              />
            </div>
          )}
          {/* Checkboxes */}
          {checkboxes && (
            <div className="mx-0 mb-1 sm:mb-4">
              {checkboxes.map(({ label }, index) => (
                <div key={`checkbox-${index}`} className="mx-0 my-1 flex items-baseline">
                  <input
                    id={label}
                    type="checkbox"
                    name={label}
                    checked={checkedState[index] ?? false}
                    onChange={() => changeCheckboxHandler(index)}
                    className="cursor-pointer"
                  />
                  <label htmlFor={label} className="ml-2">
                    {label}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
        {btn && (
          <div className={`${btnPosition === 'left' ? 'text-left' : btnPosition === 'right' ? 'text-right' : 'text-center'}`}>
            <button type={btn.type || 'button'} className="btn btn-primary sm:mb-0" disabled={disabled}>
              {btn.title}
            </button>
          </div>
        )}
      </fieldset>
    </form>
  );
};

export default Form;
