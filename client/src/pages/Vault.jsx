import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Shield, ArrowLeft, AlertCircle } from "lucide-react";
import { useVault } from "../hooks/useVault";
import { useGameStore } from "../store/game";
import MachineCard from "../components/MachineCard";

export default function Vault() {
  const { t } = useTranslation();
  const { machines } = useGameStore();
  const { retrieveFromVault, loading } = useVault();

  // Filter machines that are in vault
  const vaultMachines = machines.filter(machine => machine.status === 'VAULT');

  const handleRetrieveFromVault = useCallback(async (machineId) => {
    try {
      await retrieveFromVault(machineId);
      toast.success(t('vault.retrieve_success'));
    } catch (error) {
      console.error('Error retrieving machine from vault:', error);
      toast.error(t('vault.retrieve_error'));
    }
  }, [retrieveFromVault, t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">{t('vault.loading')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-white">{t('vault.title')}</h1>
          </div>
          <p className="text-gray-400">{t('vault.subtitle')}</p>
        </div>

        {vaultMachines.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="mx-auto h-16 w-16 text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              {t('vault.empty')}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {t('vault.empty_hint')}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">
                {t('vault.stored_machines')} ({vaultMachines.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {vaultMachines.map((machine) => (
                <MachineCard
                  key={machine.id}
                  machine={machine}
                  showActions={true}
                  onRetrieve={() => handleRetrieveFromVault(machine.id)}
                  retrieveLabel={t('vault.retrieve_from_vault')}
                  isVault={true}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}