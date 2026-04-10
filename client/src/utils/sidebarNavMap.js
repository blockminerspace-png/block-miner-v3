import {
  LayoutDashboard,
  ShoppingCart,
  Cpu,
  Wallet,
  Gift,
  Link as LinkIcon,
  Calendar,
  Youtube,
  Trophy,
  Gamepad2,
  Zap,
  Tag,
  Folder,
  Map,
  Calculator,
  Eye,
  BookOpen,
  BarChart3,
  LifeBuoy,
  Sparkles,
  ListChecks,
} from 'lucide-react';

/** Lucide name → component (user sidebar API returns `icon` string). */
export const SIDEBAR_ICON_MAP = {
  LayoutDashboard,
  ShoppingCart,
  Cpu,
  Wallet,
  Gift,
  Link: LinkIcon,
  Calendar,
  Youtube,
  Trophy,
  Gamepad2,
  Zap,
  Tag,
  Folder,
  Map,
  Calculator,
  Eye,
  BookOpen,
  BarChart3,
  LifeBuoy,
  Sparkles,
  ListChecks,
};

/**
 * @param {unknown} iconName
 * @returns {import('react').ComponentType<{ className?: string }>}
 */
export function resolveSidebarIcon(iconName) {
  if (typeof iconName !== 'string') return LayoutDashboard;
  return SIDEBAR_ICON_MAP[iconName] || LayoutDashboard;
}

const MINI_PASS_PATH = '/mini-pass';

/**
 * Ensures Mini Pass is never nested under the Rewards folder (legacy API/admin mistakes).
 * @param {unknown} categories
 * @returns {object[]}
 */
export function normalizeMiniPassOutOfRewardsGroup(categories) {
  if (!Array.isArray(categories)) return [];
  return categories.map((cat) => {
    if (!cat || typeof cat !== 'object') return /** @type {object} */ (cat);
    const isEarn =
      cat.section === 'earn' || cat.titleKey === 'sidebar.categories.earn';
    if (!isEarn) return /** @type {object} */ (cat);

    const items = Array.isArray(cat.items) ? [...cat.items] : [];
    let pulled = null;

    const cleaned = items.map((item) => {
      if (!item?.children?.length) return item;
      const kept = [];
      for (const ch of item.children) {
        if (
          ch?.itemId === 'mini_pass' ||
          ch?.path === MINI_PASS_PATH ||
          ch?.labelKey === 'sidebar.mini_pass'
        ) {
          pulled = {
            itemId: 'mini_pass',
            labelKey: ch.labelKey || 'sidebar.mini_pass',
            icon: ch.icon || 'Trophy',
            path: ch.path || MINI_PASS_PATH,
          };
        } else {
          kept.push(ch);
        }
      }
      return { ...item, children: kept };
    });

    const hasTopMini = cleaned.some(
      (i) =>
        !i?.children?.length &&
        (i?.itemId === 'mini_pass' || i?.path === MINI_PASS_PATH)
    );
    if (pulled && !hasTopMini) {
      const checkIx = cleaned.findIndex((i) => i?.itemId === 'checkin');
      const rewardsIx = cleaned.findIndex(
        (i) => i?.itemId === 'rewards_group' || (i?.children?.length && !i?.path)
      );
      let insertAt = 0;
      if (checkIx >= 0) insertAt = checkIx + 1;
      else if (rewardsIx >= 0) insertAt = rewardsIx;
      cleaned.splice(insertAt, 0, pulled);
    }

    return { ...cat, items: cleaned };
  });
}

/**
 * @param {object} item
 * @param {(key: string) => string} t
 */
function mapChildItem(item, t) {
  const Icon = resolveSidebarIcon(item.icon);
  return {
    key: item.itemId || item.path,
    Icon,
    label: t(item.labelKey),
    path: item.path,
  };
}

/**
 * @param {object} item
 * @param {(key: string) => string} t
 */
export function mapNavItem(item, t) {
  const Icon = resolveSidebarIcon(item.icon);
  if (Array.isArray(item.children) && item.children.length > 0) {
    return {
      type: 'group',
      key: item.itemId || item.labelKey,
      Icon,
      label: t(item.labelKey),
      children: item.children.map((ch) => mapChildItem(ch, t)),
    };
  }
  return {
    type: 'link',
    key: item.itemId || item.path,
    Icon,
    label: t(item.labelKey),
    path: item.path,
  };
}

/**
 * @param {object[]} apiCategories
 * @param {(key: string) => string} t
 */
export function mapApiCategoriesToMenu(apiCategories, t) {
  if (!Array.isArray(apiCategories)) return [];
  return apiCategories.map((cat) => ({
    title: t(cat.titleKey),
    items: (cat.items || []).map((item) => mapNavItem(item, t)),
  }));
}
