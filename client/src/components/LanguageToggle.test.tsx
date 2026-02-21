import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageToggle } from './LanguageToggle';
import { useStore } from '../store/useStore';

describe('LanguageToggle', () => {
  beforeEach(() => {
    useStore.setState({ locale: 'de' });
  });

  it('rendert zwei Buttons (DE und EN)', () => {
    render(<LanguageToggle />);
    expect(screen.getByRole('button', { name: 'Deutsch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
  });

  it('wechselt Locale im Store nach Klick auf English', () => {
    render(<LanguageToggle />);
    screen.getByRole('button', { name: 'English' }).click();
    expect(useStore.getState().locale).toBe('en');
  });
});
