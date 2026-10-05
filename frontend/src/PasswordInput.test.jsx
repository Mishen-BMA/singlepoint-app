import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import PasswordInput from './PasswordInput';

test('toggles password visibility accessibly without changing the value', () => {
  render(<PasswordInput aria-label="Password" value="Secret value" onChange={() => {}} />);
  const input = screen.getByLabelText('Password');
  const toggle = screen.getByRole('button', { name: 'Show password' });

  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveValue('Secret value');
  fireEvent.click(toggle);
  expect(input).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  expect(input).toHaveValue('Secret value');
});
