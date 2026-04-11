import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Single image attachment with load-error fallback.
 *
 * @param {{ attachment: { url: string, mimeType?: string }, variant: 'default' | 'compact', t: (k: string) => string }} props
 */
function SupportAttachmentItem({ attachment, variant, t }) {
  const [failed, setFailed] = useState(false);
  const compact = variant === 'compact';
  const imgClass = compact
    ? 'max-h-32 max-w-[200px] object-cover bg-black/30'
    : 'max-h-[min(70vh,28rem)] w-full max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl object-contain bg-black/30';

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      title={t('support_tickets.attachment_open_full')}
      className="block rounded-lg border border-white/10 overflow-hidden hover:border-primary/50 transition-colors"
    >
      {failed ? (
        <span className="flex items-center justify-center px-3 py-8 text-xs text-slate-400 bg-black/40 max-w-xs text-center">
          {t('support_tickets.attachment_failed')}
        </span>
      ) : (
        <img
          src={attachment.url}
          alt={t('support_tickets.attachment_alt')}
          className={imgClass}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </a>
  );
}

/**
 * Renders support ticket image attachments as preview tiles (large by default for verification).
 *
 * @param {{ attachments?: Array<{ url: string, mimeType?: string }>, className?: string, variant?: 'default' | 'compact' }} props
 */
export default function SupportAttachmentThumbnails({
  attachments = [],
  className = '',
  variant = 'default'
}) {
  const { t } = useTranslation();
  if (!attachments.length) return null;

  return (
    <div className={`flex flex-wrap gap-3 mt-3 ${className}`}>
      {attachments.map((a) => (
        <SupportAttachmentItem key={a.url} attachment={a} variant={variant} t={t} />
      ))}
    </div>
  );
}
