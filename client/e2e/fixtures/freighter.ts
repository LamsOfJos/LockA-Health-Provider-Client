import type { Page } from '@playwright/test';

/**
 * Mock/stub for the `@stellar/freighter-api` browser extension bridge.
 *
 * Freighter's client library never talks to a `window.freighterApi` global —
 * it `window.postMessage`s a `FREIGHTER_EXTERNAL_MSG_REQUEST` envelope and
 * waits for a same-origin `FREIGHTER_EXTERNAL_MSG_RESPONSE` reply carrying a
 * matching `messagedId` (see `@stellar/freighter-api/build/index.min.js`).
 * That's normally answered by the extension's content script; this fixture
 * installs a page-context listener via `page.addInitScript` that answers the
 * same envelope, so specs can exercise the connected-wallet UI without a
 * real browser extension. `isConnected()` additionally short-circuits on a
 * plain `window.freighter` boolean, which we also set.
 */

export const FREIGHTER_TEST_ADDRESS = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';
export const FREIGHTER_TEST_NETWORK = 'TESTNET';
export const FREIGHTER_TEST_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export interface FreighterMockOptions {
  /** Whether the "extension" is installed at all. Defaults to true. */
  installed?: boolean;
  /** Whether the wallet has already granted this site access. Defaults to false. */
  preApproved?: boolean;
  address?: string;
  network?: string;
  networkPassphrase?: string;
}

/**
 * Installs the Freighter mock for every subsequent navigation in `page`.
 * Call this before `page.goto(...)`.
 */
export async function mockFreighter(page: Page, options: FreighterMockOptions = {}): Promise<void> {
  const {
    installed = true,
    preApproved = false,
    address = FREIGHTER_TEST_ADDRESS,
    network = FREIGHTER_TEST_NETWORK,
    networkPassphrase = FREIGHTER_TEST_NETWORK_PASSPHRASE,
  } = options;

  await page.addInitScript(
    ({ installed, preApproved, address, network, networkPassphrase }) => {
      const win = window as unknown as { freighter?: boolean };

      if (!installed) {
        win.freighter = false;
        return;
      }

      win.freighter = true;
      let allowed = preApproved;

      window.addEventListener('message', (event: MessageEvent) => {
        if (event.source !== window) return;
        const data = event.data as { source?: string; type?: string; messageId?: number } | undefined;
        if (!data || data.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST') return;

        const respond = (payload: Record<string, unknown>) => {
          window.postMessage(
            { source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE', messagedId: data.messageId, ...payload },
            window.location.origin,
          );
        };

        switch (data.type) {
          case 'REQUEST_CONNECTION_STATUS':
            respond({ isConnected: true });
            break;
          case 'REQUEST_ALLOWED_STATUS':
            respond({ isAllowed: allowed });
            break;
          case 'REQUEST_ACCESS':
            allowed = true;
            respond({ publicKey: address });
            break;
          case 'REQUEST_PUBLIC_KEY':
            respond({ publicKey: allowed ? address : '' });
            break;
          case 'REQUEST_NETWORK_DETAILS':
            respond({
              networkDetails: {
                network,
                networkName: network,
                networkUrl: 'https://horizon-testnet.stellar.org',
                networkPassphrase,
              },
            });
            break;
          default:
            break;
        }
      });
    },
    { installed, preApproved, address, network, networkPassphrase },
  );
}
