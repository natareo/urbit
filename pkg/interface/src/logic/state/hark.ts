import {
  archive,
  markCountAsRead,
  NotificationGraphConfig,
  NotifIndex,
  readNote,
  Timebox,
  Unreads
} from '@urbit/api';
import { patp2dec } from 'urbit-ob';
import _ from 'lodash';
import BigIntOrderedMap from '@urbit/api/lib/BigIntOrderedMap';
import api from '~/logic/api';
import { useCallback } from 'react';

import { createState, createSubscription, pokeOptimisticallyN, reduceState, reduceStateN } from './base';
import { reduce, reduceGraph, reduceGroup } from '../reducers/hark-update';
import { BigInteger } from 'big-integer';

export const HARK_FETCH_MORE_COUNT = 3;

export interface HarkState {
  archivedNotifications: BigIntOrderedMap<Timebox>;
  doNotDisturb: boolean;
  getMore: () => Promise<boolean>;
  getSubset: (offset: number, count: number, isArchive: boolean) => Promise<void>;
  // getTimeSubset: (start?: Date, end?: Date) => Promise<void>;
  notifications: BigIntOrderedMap<Timebox>;
  unreadNotes: Timebox;
  notificationsCount: number;
  notificationsGraphConfig: NotificationGraphConfig; // TODO unthread this everywhere
  notificationsGroupConfig: string[];
  unreads: Unreads;
  archive: (index: NotifIndex, time?: BigInteger) => Promise<void>;
  readNote: (index: NotifIndex) => Promise<void>;
  readCount: (resource: string, index?: string) => Promise<void>;
}

const useHarkState = createState<HarkState>(
  'Hark',
  (set, get) => ({
    archivedNotifications: new BigIntOrderedMap<Timebox>(),
    doNotDisturb: false,
    unreadNotes: [],
    readCount: async (resource: string, index?: string) => {
      const poke = markCountAsRead(resource, index);
      await pokeOptimisticallyN(useHarkState, poke, [reduce]);
    },
    archive: async (index: NotifIndex, time?: BigInteger) => {
      const poke = archive(index, time);
      await pokeOptimisticallyN(useHarkState, poke, [reduce]);
    },
    readNote: async (index) => {
      await pokeOptimisticallyN(useHarkState, readNote(index), [reduce]);
    },
    getMore: async (): Promise<boolean> => {
       const state = get();
       const offset = state.notifications.size || 0;
       await state.getSubset(offset, HARK_FETCH_MORE_COUNT, false);
       const newState = get();
       return offset === (newState?.notifications?.size || 0);
    },
    getSubset: async (offset, count, isArchive): Promise<void> => {
      const where = isArchive ? 'archive' : 'inbox';
      const { harkUpdate } = await api.scry({
        app: 'hark-store',
        path: `/recent/${where}/${offset}/${count}`
      });
      reduceState(useHarkState, harkUpdate, [reduce]);
    },

    notifications: new BigIntOrderedMap<Timebox>(),
    notificationsCount: 0,
    notificationsGraphConfig: {
      watchOnSelf: false,
      mentions: false,
      watching: []
    },
    notificationsGroupConfig: [],
    unreads: {
      graph: {},
      group: {}
    }
  }),
  [
    'unreadNotes',
    'notifications',
    'archivedNotifications',
    'unreads',
    'notificationsCount'
  ],
  [
    (set, get) => createSubscription('hark-store', '/updates', (j) => {
      const d = _.get(j, 'harkUpdate', false);
      if (d) {
        reduceStateN(get(), d, [reduce]);
      }
    }),
    (set, get) => createSubscription('hark-graph-hook', '/updates', (j) => {
      const graphHookData = _.get(j, 'hark-graph-hook-update', false);
      if (graphHookData) {
        reduceStateN(get(), graphHookData, reduceGraph);
      }
    }),
    (set, get) => createSubscription('hark-group-hook', '/updates', (j) => {
      const data = _.get(j, 'hark-group-hook-update', false);
      if (data) {
        reduceStateN(get(), data, reduceGroup);
      }
    })
  ]
);

export function useHarkDm(ship: string) {
  return useHarkState(
    useCallback(
      (s) => {
        return s.unreads.graph[`/ship/~${window.ship}/dm-inbox`]?.[
          `/${patp2dec(ship)}`
        ];
      },
      [ship]
    )
  );
}

export default useHarkState;
