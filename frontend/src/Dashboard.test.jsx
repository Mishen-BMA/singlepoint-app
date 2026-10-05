import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import Dashboard from './Dashboard';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));

const user = { role: 'software_engineer', permissions: {} };
const reminder = { id: 7, message: 'Please complete your pending training.', created_at: '2026-10-05T10:00:00Z', read_at: null };

beforeEach(() => {
  vi.clearAllMocks();
  api.mockImplementation((path) => {
    if (path === '/policies') return Promise.resolve([]);
    if (path === '/training/progress/me') return Promise.resolve([]);
    if (path === '/incidents') return Promise.resolve({ incidents: [] });
    if (path === '/training/survey') return Promise.resolve({ complete: true });
    if (path === '/compliance/reminders/me') return Promise.resolve([reminder]);
    if (path === '/compliance/reminders/7/read') return Promise.resolve({ ...reminder, read_at: '2026-10-05T10:01:00Z' });
    return Promise.reject(new Error(`Unexpected API call: ${path}`));
  });
});

test('shows an unread reminder popup after dashboard data loads and acknowledges it', async () => {
  render(<Dashboard user={user} />);

  expect(await screen.findByRole('dialog', { name: /compliance reminder/i })).toBeInTheDocument();
  expect(screen.getByText(reminder.message)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));

  await waitFor(() => expect(api).toHaveBeenCalledWith('/compliance/reminders/7/read', { method: 'PATCH' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /compliance reminder/i })).not.toBeInTheDocument());
});
