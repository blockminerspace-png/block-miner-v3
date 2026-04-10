import { useTranslation } from 'react-i18next';

/**
 * @param {{ attachments?: Array<{ url: string, mimeType?: string }>, className?: string }} props
 */
export default function SupportAttachmentThumbnails({ attachments = [], className = '' }) {
  const { t } = useTranslation();
  if (!attachments.length) return null;

  return (
    <div className={`flex flex-wrap gap-2 mt-3 ${className}`}>
      {attachments.map((a) => (
        <a
          key={a.url}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border border-white/10 overflow-hidden hover:border-primary/50 transition-colors"
        >
          <img
            src={a.url}
            alt={t('support_tickets.attachment_alt')}
            className="max-h-32 max-w-[200px] object-cover bg-black/30"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
