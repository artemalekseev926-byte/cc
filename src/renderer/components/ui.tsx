import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  title,
  size = 'md',
  icon,
  type = 'button',
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  type?: 'button' | 'submit';
}) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size}`} onClick={onClick} disabled={disabled} title={title}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} className="btn-icon" />}
      {children}
    </button>
  );
}

export function Hint({ text }: { text: string }) {
  return (
    <span className="hint" tabIndex={0} aria-label={text}>
      ?<span className="hint-bubble">{text}</span>
    </span>
  );
}

export function Field({ label, hint, children, disabled, disabledReason }: { label: string; hint?: string; children: ReactNode; disabled?: boolean; disabledReason?: string }) {
  return (
    <div className={`field ${disabled ? 'field-disabled' : ''}`} title={disabled ? disabledReason : undefined}>
      <div className="field-label">
        <span>{label}</span>
        {hint && <Hint text={hint} />}
      </div>
      <div className="field-control">{children}</div>
      {disabled && disabledReason && (
        <div className="field-note">
          <Icon name="lock" size={12} /> {disabledReason}
        </div>
      )}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  disabled,
  marks,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
  marks?: [string, string];
}) {
  return (
    <div className="slider">
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="slider-value">{format(value)}</span>
      </div>
      {marks && (
        <div className="slider-marks">
          <span>{marks[0]}</span>
          <span>{marks[1]}</span>
        </div>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label className={`toggle ${disabled ? 'toggle-disabled' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: IconName; disabled?: boolean }>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'active' : ''}
          disabled={disabled || o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SWATCHES = ['#ffffff', '#000000', '#ff4d6d', '#ff8a3d', '#ffd23f', '#3ddc84', '#00c2ff', '#3d7bff', '#6c5cff', '#c45bff', '#ff5cc8', '#8a8f98'];

export function ColorField({ value, onChange, disabled, allowNone, noneLabel }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean; allowNone?: boolean; noneLabel?: string }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  return (
    <div className={`color-field ${disabled ? 'disabled' : ''}`}>
      <div className="color-swatches">
        {allowNone && (
          <button type="button" className={`swatch swatch-none ${value === null ? 'active' : ''}`} title={noneLabel} disabled={disabled} onClick={() => onChange(null)}>
            ∅
          </button>
        )}
        {SWATCHES.map((c) => (
          <button
            type="button"
            key={c}
            className={`swatch ${value?.toLowerCase() === c ? 'active' : ''}`}
            style={{ background: c }}
            title={c}
            disabled={disabled}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
      <div className="color-input-row">
        <input type="color" value={(value ?? '#000000').slice(0, 7)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        <input
          className="color-hex"
          value={text}
          disabled={disabled}
          placeholder={allowNone ? noneLabel : '#RRGGBB'}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
        />
      </div>
    </div>
  );
}

export function Modal({ title, children, onClose, footer, wide }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={`progress progress-${tone}`}>
      <div className="progress-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="tip">
      <Icon name="lightbulb" size={16} className="tip-icon" />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={44} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
