import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

test('shows the real sign-in screen without a demo role switcher', async () => {
  sessionStorage.clear();
  render(<App />);
  expect(await screen.findByRole('heading', { name: /singlepoint/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toBeInTheDocument();
  expect(screen.queryByText(/demo role/i)).not.toBeInTheDocument();
});

test('switches and remembers the light theme from the login screen', async () => {
  sessionStorage.clear();
  localStorage.clear();
  const { container } = render(<App />);
  const toggle = await screen.findByRole('button', { name: 'Switch to light mode' });

  fireEvent.click(toggle);

  expect(container.querySelector('.theme-light')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toHaveAttribute('aria-pressed', 'true');
  expect(localStorage.getItem('singlepoint-theme')).toBe('light');
});


test('shows and hides the login password', async () => {
  sessionStorage.clear();
  render(<App />);
  const input = await screen.findByLabelText('Password');
  const toggle = screen.getByRole('button', { name: 'Show password' });
  fireEvent.change(input, { target: { value: 'test-password' } });
  fireEvent.click(toggle);
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue('test-password');
});
