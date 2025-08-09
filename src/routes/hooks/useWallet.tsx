
import { $, useSignal, useStore, useVisibleTask$ } from '@builder.io/qwik';
import { createWalletClient, custom } from 'viem';
import { base } from 'viem/chains';

// Extend Window interface to include ethereum property
declare global {
  interface Window {
    ethereum: any;
  }
}
/* 
// Define the DazLabs network
export const DAZLABS_NETWORK = {
  id: 1337,
  name: 'DazLabs',
  network: 'dazlabs',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ['http://192.168.50.59:8545']
    }
  },
  blockExplorers: {
    default: { name: 'Local Explorer', url: 'http://192.168.50.59:8545' }
  },
  testnet: true
}; */


// Define the wallet store type
export interface WalletStore {
  address?: string;
  connected: boolean;
  chainId?: number;
  error?: string;
  isCorrectNetwork?: boolean;
}

// Create a global wallet state to be shared across components
// This prevents multiple connection instances
let globalWalletState: WalletStore = { connected: false };
// Use a mutable object container instead of reassigning the variable
const globalWalletClientContainer: { current: any } = { current: undefined }; // viem wallet client, not tracked by Qwik
// Use a mutable object for listeners as well
const listenersContainer: { current: (() => void)[] } = { current: [] };

// Notify all listeners when wallet state changes
const notifyListeners = () => {
  listenersContainer.current.forEach((listener: () => void) => listener());
};

// Helper function to update global wallet state safely
const updateGlobalWalletState = (newState: Partial<WalletStore>) => {
  globalWalletState = { ...globalWalletState, ...newState };
  notifyListeners();
};

export function useWallet() {
  const wallet = useStore<WalletStore>({ 
    address: globalWalletState.address,
    connected: globalWalletState.connected,
    chainId: globalWalletState.chainId,
    error: globalWalletState.error,
    isCorrectNetwork: globalWalletState.isCorrectNetwork
  });
  
  // Sync with global state
  useVisibleTask$(({ cleanup }) => {
    const updateLocalState = () => {
      wallet.address = globalWalletState.address;
      wallet.connected = globalWalletState.connected;
      wallet.chainId = globalWalletState.chainId;
      wallet.error = globalWalletState.error;
      wallet.isCorrectNetwork = globalWalletState.isCorrectNetwork;
      // Do NOT set walletClient on wallet store
    };

    // Add this component as a listener
    listenersContainer.current.push(updateLocalState);

    // Initial sync
    updateLocalState();

    // Auto-reinitialize walletClient if wallet is connected and client is missing
    if (typeof window !== 'undefined' && window.ethereum && globalWalletState.connected && !globalWalletClientContainer.current) {
      globalWalletClientContainer.current = createWalletClient({
        chain: base,
        transport: custom(window.ethereum)
      });
    }

    // Clean up listener when component unmounts
    cleanup(() => {
      listenersContainer.current = listenersContainer.current.filter(
        (listener: () => void) => listener !== updateLocalState
      );
    });
  });
  
  // Function to add DazLabs network to MetaMask
  const addDazLabsNetwork = $(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return false;
    }

    try {
      // Try to switch to DazLabs network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${base.id.toString(16)}` }],
      });
      return true;
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${base.id.toString(16)}`,
                chainName: base.name,
                rpcUrls: [base.rpcUrls.default.http[0]],
                nativeCurrency: base.nativeCurrency,
              },
            ],
          });
          return true;
        } catch (addError) {
          console.error('Error adding network:', addError);
          return false;
        }
      }
      // Handle other errors
      console.error('Error switching network:', switchError);
      return false;
    }
  });

  // Handle account changes
  const handleAccountsChanged = $((accounts: string[]) => {
    if (accounts.length === 0) {
      // User disconnected their wallet
      updateGlobalWalletState({
        connected: false,
        address: undefined,
      });
    } else {
      // User switched accounts
      updateGlobalWalletState({
        address: accounts[0],
        connected: true,
      });
    }
  });

  // Handle chain changes
  const handleChainChanged = $((chainId: string) => {
    const parsedChainId = parseInt(chainId, 16);
    updateGlobalWalletState({
      chainId: parsedChainId,
      isCorrectNetwork: parsedChainId === base.id
    });
    // Reload the page as recommended by MetaMask
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  });

  // Track if connection is in progress to prevent multiple requests
  const isConnecting = useSignal(false);

  // Function to handle the actual wallet connection process (QRL)
  const performWalletConnection = $(async (addNetwork = true) => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }
      const client = createWalletClient({
        chain: base,
        transport: custom(window.ethereum)
      });
      const addresses = await client.requestAddresses();
      // Store walletClient in global state
      globalWalletClientContainer.current = client; // Set wallet client in module scope only
      // Get the current chain ID
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const parsedChainId = parseInt(chainId, 16);
      // Check if user is on DazLabs network
      const isCorrectNetwork = parsedChainId === base.id;
      // If not on DazLabs and addNetwork is true, try to add/switch to DazLabs
      if (!isCorrectNetwork && addNetwork) {
        await addDazLabsNetwork();
        // Re-check chain ID after network switch
        const newChainId = await window.ethereum.request({ method: 'eth_chainId' });
        const newParsedChainId = parseInt(newChainId, 16);
        // Update global state
        updateGlobalWalletState({
          address: addresses[0],
          connected: true,
          chainId: newParsedChainId,
          isCorrectNetwork: newParsedChainId === base.id,
          error: undefined
        });
      } else {
        // Update global state
        updateGlobalWalletState({
          address: addresses[0],
          connected: true,
          chainId: parsedChainId,
          isCorrectNetwork,
          error: undefined
        });
      }
      // Setup listeners for account and chain changes
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
      }
      return true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      if (error instanceof Error && error.message?.includes('Already processing eth_requestAccounts')) {
        console.warn('MetaMask is already processing a connection request. Please check your MetaMask popup.');
        updateGlobalWalletState({
          error: 'MetaMask connection dialog already open. Please check your MetaMask extension.',
        });
      } else {
        updateGlobalWalletState({
          error: 'Failed to connect: ' + (error instanceof Error ? error.message : String(error)),
        });
      }
      return false;
    }
  });

  // Function to connect the wallet - wrapper for performWalletConnection
  const connectWallet = $(async (addNetwork = true) => {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting.value) {
      console.log('Connection already in progress, please wait...');
      return false;
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      // MetaMask not installed
      updateGlobalWalletState({
        error: 'MetaMask is not installed',
      });
      
      // Show alert
      if (typeof window !== 'undefined') {
        alert('MetaMask is not installed. Please install MetaMask to connect your wallet.');
        // Redirect to MetaMask installation page
        if (confirm('Would you like to install MetaMask?')) {
          window.open('https://metamask.io/download/', '_blank');
        }
      }
      return false;
    }
    
    isConnecting.value = true;
    
    try {
      // Check if already connected first
      if (globalWalletState.connected && globalWalletState.address) {
        console.log('Wallet already connected:', globalWalletState.address);
        
        // If we need to add/switch network but already connected
        if (addNetwork && globalWalletState.chainId !== base.id) {
          await addDazLabsNetwork();
        }
        
        return true;
      }
      
      // Use the helper function to perform the wallet connection (QRL)
      return await performWalletConnection(addNetwork);
    } catch (e) {
      // Any errors will be handled inside performWalletConnection
      console.error('Error in connectWallet wrapper:', e);
      return false;
    } finally {
      // Always reset connection state when done, even if there was an error
      isConnecting.value = false;
    }
  });
  
  // Function to disconnect wallet (if needed)
  const disconnectWallet = $(() => {
    // Note: MetaMask doesn't have a disconnect method
    // We can only reset our state
    updateGlobalWalletState({ 
      connected: false,
      address: undefined,
      chainId: undefined,
      isCorrectNetwork: false,
      error: undefined
    });
    
    // Remove listeners
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  });
  
  return {
    wallet,
    walletClient: globalWalletClientContainer.current,
    connectWallet,
    disconnectWallet,
    addDazLabsNetwork,
    base,
    isConnecting,
    // Defensive re-init for walletClient
    initWalletClient: $(async function() {
      if (!globalWalletState.connected || !globalWalletState.address) return null;
      if (typeof window === 'undefined' || !window.ethereum) return null;
      try {
        const client = createWalletClient({
          chain: base,
          transport: custom(window.ethereum)
        });
        globalWalletClientContainer.current = client;
        return client;
      } catch (e) {
        console.error('[useWallet] walletClient re-init failed:', e);
        return null;
      }
    })
  }
  }

