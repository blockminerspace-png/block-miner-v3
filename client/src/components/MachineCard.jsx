import { useTranslation } from "react-i18next";
import { formatHashrate, DEFAULT_MINER_IMAGE_URL, getMachineDescriptor } from "../utils/machine";

export default function MachineCard({
  machine,
  showActions = false,
  onRetrieve,
  retrieveLabel,
  isVault = false
}) {
  const { t } = useTranslation();
  const descriptor = getMachineDescriptor(machine);

  return (
    <div className="bg-gray-800/30 border border-gray-800/50 rounded-2xl p-4 hover:border-gray-700 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gray-900/50 rounded-xl p-2 border border-gray-800/50 shrink-0">
          <img
            src={descriptor.image}
            alt={machine.minerName || descriptor.name}
            className="w-full h-full object-contain"
            onError={(e) => { e.target.src = DEFAULT_MINER_IMAGE_URL; }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white truncate">
            {machine.minerName || descriptor.name}
          </h4>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <span>{t("inventory.modal.level")} {machine.level}</span>
            <span>·</span>
            <span className="text-primary font-black">{formatHashrate(machine.hashRate)}</span>
          </div>
        </div>
        {showActions && onRetrieve && (
          <button
            onClick={onRetrieve}
            className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/80 transition-colors"
          >
            {retrieveLabel || t('vault.retrieve_from_vault')}
          </button>
        )}
      </div>
    </div>
  );
}