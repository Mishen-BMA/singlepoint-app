import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the real sign-in screen without a demo role switcher', async () => {
  sessionStorage.clear();
  render(<App />);
  expect(await screen.findByRole('heading', { name: /singlepoint/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.queryByText(/demo role/i)).not.toBeInTheDocument();
});
