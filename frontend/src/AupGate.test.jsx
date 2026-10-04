import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import AupGate from './AupGate';

const AUP_POLICY = {
  id: 1,
  title: 'Acceptable Use Policy',
  content: 'Line one of the policy.\nLine two of the policy.\nLine three of the policy.',
  version: 3
};

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name] ?? (name === 'Content-Type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function mockFetchSequence(handlers) {
  global.fetch = vi.fn((url, options) => {
    const handler = handlers.find(([matcher]) => matcher(url, options));
    if (!handler) throw new Error(`Unexpected fetch call: ${options?.method || 'GET'} ${url}`);
    return Promise.resolve(handler[1](url, options));
  });
}

beforeEach(() => {
  sessionStorage.setItem('singlepoint-token', 'test-token');
});

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

test('renders the policy as a non-dismissible dialog and ignores Escape', async () => {
  mockFetchSequence([
    [(url) => url.includes('/policies/gate') && !url.includes('decision'), () => jsonResponse({ pending: [AUP_POLICY] })]
  ]);

  const onResolved = vi.fn();
  const onDeclined = vi.fn();
  render(<AupGate onResolved={onResolved} onDeclined={onDeclined} />);

  expect(await screen.findByRole('dialog', { name: /acceptable use policy/i })).toBeInTheDocument();
  expect(screen.getByText(/version 3/i)).toBeInTheDocument();
  expect(screen.getByRole('region', { name: /policy text/i })).toBeInTheDocument();
  expect(screen.getByText('Line one of the policy.')).toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'Escape' });

  expect(onResolved).not.toHaveBeenCalled();
  expect(onDeclined).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: /acceptable use policy/i })).toBeInTheDocument();
});

test('formats policy headings and bullets without showing markdown markers', async () => {
  mockFetchSequence([
    [(url) => url.includes('/policies/gate') && !url.includes('decision'), () => jsonResponse({
      pending: [{ ...AUP_POLICY, content: '1. Accounts and passwords\n- Use your own account.\n- Never share your password.' }]
    })]
  ]);

  render(<AupGate onResolved={vi.fn()} onDeclined={vi.fn()} />);

  expect(await screen.findByRole('heading', { name: '1. Accounts and passwords' })).toBeInTheDocument();
  expect(screen.getByRole('list')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.queryByText('- Use your own account.')).not.toBeInTheDocument();
});

test('disables Agree until the policy text is scrolled to the bottom', async () => {
  // jsdom reports 0 for scrollHeight/clientHeight by default, which the
  // component treats as "no overflow, nothing to scroll". Stub the prototype
  // getters so the component sees a long, scrollable policy body instead.
  const scrollHeightSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(500);
  const clientHeightSpy = vi.spyOn(window.HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);

  mockFetchSequence([
    [(url) => url.includes('/policies/gate') && !url.includes('decision'), () => jsonResponse({ pending: [AUP_POLICY] })]
  ]);

  render(<AupGate onResolved={vi.fn()} onDeclined={vi.fn()} />);
  const region = await screen.findByRole('region', { name: /policy text/i });
  const agreeButton = screen.getByRole('button', { name: /i agree/i });

  expect(agreeButton).toBeDisabled();

  Object.defineProperty(region, 'scrollTop', { value: 410, configurable: true, writable: true });
  fireEvent.scroll(region);
  expect(agreeButton).not.toBeDisabled();

  scrollHeightSpy.mockRestore();
  clientHeightSpy.mockRestore();
});

test('agreeing to the final pending policy resolves with the refreshed user', async () => {
  mockFetchSequence([
    [(url) => url.includes('/policies/gate') && !url.includes('decision'), () => jsonResponse({ pending: [AUP_POLICY] })],
    [(url, options) => url.includes('/policies/gate/decision') && JSON.parse(options.body).decision === 'agreed',
      () => jsonResponse({ ok: true, pending: [] })],
    [(url) => url.includes('/auth/me'), () => jsonResponse({ id: 2, name: 'Staff User', role: 'staff', aupPending: false })]
  ]);

  const onResolved = vi.fn();
  render(<AupGate onResolved={onResolved} onDeclined={vi.fn()} />);
  await screen.findByRole('dialog', { name: /acceptable use policy/i });

  const agreeButton = await screen.findByRole('button', { name: /i agree/i, hidden: false });
  await waitFor(() => expect(agreeButton).not.toBeDisabled());
  fireEvent.click(agreeButton);

  await waitFor(() => expect(onResolved).toHaveBeenCalledWith(expect.objectContaining({ aupPending: false })));
});

test('disagreeing requires an inline confirmation before ending the session', async () => {
  mockFetchSequence([
    [(url) => url.includes('/policies/gate') && !url.includes('decision'), () => jsonResponse({ pending: [AUP_POLICY] })],
    [(url, options) => url.includes('/policies/gate/decision') && JSON.parse(options.body).decision === 'declined',
      () => jsonResponse({ ok: true, declined: true })]
  ]);

  const onDeclined = vi.fn();
  render(<AupGate onResolved={vi.fn()} onDeclined={onDeclined} />);
  await screen.findByRole('dialog', { name: /acceptable use policy/i });

  fireEvent.click(screen.getByRole('button', { name: /i disagree/i }));
  expect(screen.getByText(/declining will end your session/i)).toBeInTheDocument();
  expect(onDeclined).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /go back/i }));
  expect(screen.queryByText(/declining will end your session/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /i disagree/i }));
  fireEvent.click(screen.getByRole('button', { name: /yes, decline and leave/i }));

  await waitFor(() => expect(onDeclined).toHaveBeenCalled());
});
