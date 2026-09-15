import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar';
import { truncateAddress } from '../lib/format';
import type { WalletStatus } from '../hooks/useWallet';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/search', label: 'Patient Search' },
  { to: '/records', label: 'Medical Records' },
  { to: '/access', label: 'Access Management' },
  { to: '/audit', label: 'Audit Log' },
  { to: '/profile', label: 'Provider Profile' },
];

function renderNavbar(
  props: Partial<{
    walletStatus: WalletStatus;
    address: string | null;
    network: string | null;
  }> = {},
  route = '/',
) {
  const onConnect = vi.fn();
  const onDisconnect = vi.fn();
  render(
    <MemoryRouter initialEntries={[route]}>
      <Navbar
        walletStatus={props.walletStatus ?? 'idle'}
        address={props.address ?? null}
        network={props.network ?? null}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />
    </MemoryRouter>,
  );
  return { onConnect, onDisconnect };
}

describe('Navbar', () => {
  describe('wallet status rendering', () => {
    it('shows the truncated address, network, and a working Disconnect button when connected', () => {
      const address = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';
      const { onDisconnect } = renderNavbar({ walletStatus: 'connected', address, network: 'TESTNET' });

      expect(screen.getByText(truncateAddress(address, 6))).toBeInTheDocument();
      expect(screen.getByText('TESTNET')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Connect Wallet' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      expect(onDisconnect).toHaveBeenCalledTimes(1);
    });

    it('shows an enabled "Connect Wallet" button when disconnected', () => {
      const { onConnect } = renderNavbar({ walletStatus: 'idle' });

      const connectButton = screen.getByRole('button', { name: 'Connect Wallet' });
      expect(connectButton).not.toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();

      fireEvent.click(connectButton);
      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it('shows a disabled "Install Freighter" button when the wallet is unavailable', () => {
      renderNavbar({ walletStatus: 'unavailable' });

      const button = screen.getByRole('button', { name: 'Install Freighter' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Freighter wallet extension not detected');
    });

    it('shows a spinner and disables the button while connecting', () => {
      renderNavbar({ walletStatus: 'connecting' });

      const button = screen.getByRole('button', { name: /Connecting/ });
      expect(button).toBeDisabled();
      expect(button.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('active nav-link highlighting', () => {
    it.each(NAV_ITEMS)('marks "$label" ($to) active and leaves the other nav items inactive', ({ to, label }) => {
      renderNavbar({}, to);

      expect(screen.getByRole('link', { name: label })).toHaveClass('nav-link', 'active');

      for (const other of NAV_ITEMS) {
        if (other.to === to) continue;
        expect(screen.getByRole('link', { name: other.label })).not.toHaveClass('active');
      }
    });
  });

  describe('mobile menu', () => {
    it('is closed by default and toggles open/closed when the menu button is clicked', () => {
      renderNavbar();

      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1);

      const toggle = screen.getByRole('button', { name: 'Toggle menu' });
      fireEvent.click(toggle);
      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(2);

      fireEvent.click(toggle);
      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1);
    });

    it('closes the mobile menu when a nav item inside it is clicked', () => {
      renderNavbar();

      fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
      const mobileLinks = screen.getAllByRole('link', { name: 'Patient Search' });
      expect(mobileLinks).toHaveLength(2);

      fireEvent.click(mobileLinks[1]);

      expect(screen.getAllByRole('link', { name: 'Patient Search' })).toHaveLength(1);
    });
  });
});
