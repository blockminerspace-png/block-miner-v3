/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { LayoutDashboard } from 'lucide-react';
import {
  mapApiCategoriesToMenu,
  normalizeMiniPassOutOfRewardsGroup,
  resolveSidebarIcon,
} from './sidebarNavMap';

describe('sidebarNavMap', () => {
  it('maps API category with group and children', () => {
    const t = (k) => k;
    const menu = mapApiCategoriesToMenu(
      [
        {
          section: 'earn',
          titleKey: 'sidebar.categories.earn',
          items: [
            {
              itemId: 'rewards_group',
              labelKey: 'sidebar.rewards',
              icon: 'Folder',
              children: [
                {
                  itemId: 'faucet',
                  labelKey: 'sidebar.faucet',
                  icon: 'Gift',
                  path: '/faucet',
                },
              ],
            },
          ],
        },
      ],
      t
    );
    expect(menu[0].items[0].type).toBe('group');
    expect(menu[0].items[0].children).toHaveLength(1);
    expect(menu[0].items[0].children[0].path).toBe('/faucet');
  });

  it('resolveSidebarIcon falls back to LayoutDashboard for unknown name', () => {
    expect(resolveSidebarIcon('NotARealLucideIcon')).toBe(LayoutDashboard);
  });

  it('normalizeMiniPassOutOfRewardsGroup pulls mini_pass out of Rewards children', () => {
    const raw = [
      {
        section: 'earn',
        titleKey: 'sidebar.categories.earn',
        items: [
          { itemId: 'checkin', labelKey: 'sidebar.checkin', icon: 'Calendar', path: '/checkin' },
          {
            itemId: 'rewards_group',
            labelKey: 'sidebar.rewards',
            icon: 'Folder',
            children: [
              {
                itemId: 'mini_pass',
                labelKey: 'sidebar.mini_pass',
                icon: 'Trophy',
                path: '/mini-pass',
              },
              { itemId: 'faucet', labelKey: 'sidebar.faucet', icon: 'Gift', path: '/faucet' },
            ],
          },
        ],
      },
    ];
    const fixed = normalizeMiniPassOutOfRewardsGroup(raw);
    const items = fixed[0].items;
    const group = items.find((i) => i.itemId === 'rewards_group');
    expect(group.children.some((c) => c.itemId === 'mini_pass')).toBe(false);
    const miniIx = items.findIndex((i) => i.itemId === 'mini_pass');
    const checkIx = items.findIndex((i) => i.itemId === 'checkin');
    expect(miniIx).toBe(checkIx + 1);
  });
});
