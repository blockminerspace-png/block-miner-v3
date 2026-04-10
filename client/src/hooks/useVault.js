import { useCallback } from 'react';
import { api } from '../store/auth';

/**
 * Custom hook for managing vault operations
 * @returns {Object} Vault operations
 */
export function useVault() {
  const moveToVault = useCallback(async (machineId) => {
    try {
      const response = await api.post('/vault/move-to-vault', {
        machineId,
      });

      if (!response.data.ok) {
        throw new Error(response.data.message || 'Failed to move machine to vault');
      }

      return response.data;
    } catch (error) {
      console.error('Error moving machine to vault:', error);
      throw error;
    }
  }, []);

  const retrieveFromVault = useCallback(async (machineId) => {
    try {
      const response = await api.post('/vault/retrieve-from-vault', {
        machineId,
      });

      if (!response.data.ok) {
        throw new Error(response.data.message || 'Failed to retrieve machine from vault');
      }

      return response.data;
    } catch (error) {
      console.error('Error retrieving machine from vault:', error);
      throw error;
    }
  }, []);

  return {
    moveToVault,
    retrieveFromVault,
  };
}