/**
 * WalletConnect v2 (EIP-1193) for Polygon — requires VITE_WALLETCONNECT_PROJECT_ID at build time.
 *
 * Mobile deep links + relay rely on stable https metadata.url (add same URL in WalletConnect Cloud).
 */

let _instance = null;

export function isWalletConnectConfigured() {
  return Boolean(String(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "").trim());
}

/** Canonical app URL for WalletConnect metadata (no trailing slash). */
export function getWalletConnectMetadataUrl() {
  const fromEnv = String(import.meta.env.VITE_PUBLIC_WALLET_APP_URL || "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    return String(window.location.origin).replace(/\/+$/, "");
  }
  return "https://blockminer.space";
}

/**
 * @returns {Promise<import('@walletconnect/ethereum-provider').default | null>}
 */
export async function getWalletConnectEthereumProvider() {
  const projectId = String(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "").trim();
  if (!projectId) return null;

  const { default: EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const metaUrl = getWalletConnectMetadataUrl();
  const rpcUrl =
    String(import.meta.env.VITE_POLYGON_RPC_URL || "").trim() || "https://polygon-rpc.com";

  if (!_instance) {
    _instance = await EthereumProvider.init({
      projectId,
      chains: [137],
      optionalChains: [137],
      showQrModal: true,
      rpcMap: { 137: rpcUrl },
      methods: ["eth_sendTransaction", "personal_sign"],
      optionalMethods: [
        "eth_accounts",
        "eth_requestAccounts",
        "eth_sendTransaction",
        "personal_sign",
        "wallet_switchEthereumChain",
        "wallet_addEthereumChain"
      ],
      events: ["chainChanged", "accountsChanged"],
      metadata: {
        name: "BlockMiner",
        description: "POL on Polygon — BlockMiner",
        url: metaUrl,
        icons: [`${metaUrl}/favicon.ico`]
      }
    });
    _instance.on("disconnect", () => {
      _instance = null;
    });
  }
  return _instance;
}

export function resetWalletConnectSingletonForTests() {
  _instance = null;
}
