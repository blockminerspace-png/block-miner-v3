import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVault } from '../hooks/useVault';
import { api } from '../store/auth';

// Mock the API
vi.mock('../store/auth', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('useVault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('moveToVault', () => {
    it('should update machine status to VAULT and call API', async () => {
      const mockMachine = {
        id: 'machine-1',
        location: 'INVENTORY',
        status: 'IDLE',
      };

      const mockResponse = { data: { ok: true } };
      api.post.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useVault());

      await act(async () => {
        await result.current.moveToVault(mockMachine.id, 'inventory');
      });

      expect(api.post).toHaveBeenCalledWith('/vault/move-to-vault', {
        itemId: mockMachine.id,
        source: 'inventory',
      });
    });

    it('should throw error if API call fails', async () => {
      const mockMachineId = 'machine-1';
      const mockError = new Error('API Error');

      api.post.mockRejectedValue(mockError);

      const { result } = renderHook(() => useVault());

      await expect(result.current.moveToVault(mockMachineId)).rejects.toThrow('API Error');
    });
  });

  describe('retrieveFromVault', () => {
    it('should update machine status to INVENTORY and call API', async () => {
      const mockMachineId = 'machine-1';

      const mockResponse = { data: { ok: true } };
      api.post.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useVault());

      await act(async () => {
        await result.current.retrieveFromVault(mockMachineId, 'inventory');
      });

      expect(api.post).toHaveBeenCalledWith('/vault/retrieve-from-vault', {
        vaultId: mockMachineId,
        destination: 'inventory',
      });
    });

    it('should throw error if API call fails', async () => {
      const mockMachineId = 'machine-1';
      const mockError = new Error('API Error');

      api.post.mockRejectedValue(mockError);

      const { result } = renderHook(() => useVault());

      await expect(result.current.retrieveFromVault(mockMachineId)).rejects.toThrow('API Error');
    });
  });
});