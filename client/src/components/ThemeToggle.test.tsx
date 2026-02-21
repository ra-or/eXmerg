import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('class');
  });

  it('rendert einen Button mit aria-label', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: /hell|dunkel/i });
    expect(btn).toBeInTheDocument();
  });

  it('wechselt das Label nach Klick (Hell ↔ Dunkel)', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    const labelBefore = btn.getAttribute('aria-label');
    fireEvent.click(btn);
    const labelAfter = btn.getAttribute('aria-label');
    expect(labelBefore).not.toBe(labelAfter);
  });
});
