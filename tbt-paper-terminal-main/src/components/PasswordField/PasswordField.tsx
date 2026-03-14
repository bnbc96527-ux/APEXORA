import React, { useState, KeyboardEvent } from 'react';
import styles from './PasswordField.module.css';
import { Icon } from '../Icon';

type Props = {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  showStrength?: boolean;
  strength?: number;
  strengthLabel?: string;
};

export const PasswordField: React.FC<Props> = ({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  showStrength,
  strength = 0,
  strengthLabel = ''
}) => {
  const [visible, setVisible] = useState(false);

  const toggle = () => setVisible(v => !v);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  // Map strength to label and color if not provided
  const computeStrength = (val: number) => {
    if (val <= 33) return { label: 'Weak', color: '#ef4444' };
    if (val <= 66) return { label: 'Medium', color: '#f97316' };
    return { label: 'Strong', color: '#22c55e' };
  };

  const strengthInfo = computeStrength(strength);

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <span className={styles.leftIcon} aria-hidden>
          <Icon name="lock" size="sm" />
        </span>

        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={styles.input}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-describedby={showStrength ? `${id}-strength` : undefined}
        />

        <button
          type="button"
          className={styles.iconButton}
          onClick={toggle}
          onKeyDown={onKey}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size="sm" />
        </button>
      </div>

      {showStrength && (
        <div id={`${id}-strength`} className={styles.strengthRow}>
          <div className={styles.strengthBar}>
            <div
              className={styles.strengthFill}
              style={{ width: `${strength}%`, background: strengthInfo.color }}
            />
          </div>
          <div className={styles.strengthText}>{strengthInfo.label}</div>
        </div>
      )}
    </div>
  );
};

export default PasswordField;
