import { Col, Row, Text } from '@tlon/indigo-react';
import { Association, Graph, GraphNode, markEachAsRead } from '@urbit/api';
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import _ from 'lodash';
import { useResize } from '~/logic/lib/useResize';
import { LinkBlockItem } from './LinkBlockItem';
import { LinkBlockInput } from './LinkBlockInput';
import useLocalState from '~/logic/state/local';
import BigIntOrderedMap from '@urbit/api/lib/BigIntOrderedMap';
import bigInt from 'big-integer';
import airlock from '~/logic/api';
import useHarkState from '~/logic/state/hark';
import { BlockScroller } from '~/views/components/BlockScroller';

export interface LinkBlocksProps {
  graph: Graph;
  association: Association;
}

const style = {
  height: '100%',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center'
};
const PADDING = 24;
const SMALL_PADDING = 16;

export function LinkBlocks(props: LinkBlocksProps) {
  const { association } = props;
  const [linkSize, setLinkSize] = useState(250);
  const linkSizePx = `${linkSize}px`;

  const isSmall = useLocalState(s => !s.breaks.lg);
  const colCount = useMemo(() => (isSmall ? 2 : 4), [isSmall]);
  const bind = useResize<HTMLDivElement>(
    useCallback(
      (entry) => {
        const { width } = entry.target.getBoundingClientRect();
        const pad = isSmall ? SMALL_PADDING : PADDING;
        setLinkSize((width - pad) / colCount - pad);
      },
      [colCount, isSmall]
    )
  );

  useEffect(() => {
    const unreads =
      useHarkState.getState().unreads.graph?.[association.resource]?.['/']
        ?.unreads || new Set<string>();
    Array.from(unreads as Set<string>).forEach((u) => {
      airlock.poke(markEachAsRead(association.resource, '/', u));
    });
  }, [association.resource]);

  const orm = useMemo(() => {
    const nodes = [null, ...Array.from(props.graph)];

    const chunks = _.chunk(nodes, colCount);
    return new BigIntOrderedMap<[bigInt.BigInteger, GraphNode][]>().gas(
      chunks.reverse().map((chunk, i) => {
        return [bigInt(i), chunk];
      })
    );
  }, [props.graph, colCount]);

  const renderItem = useCallback(
    React.forwardRef<any, any>(({ index }, ref) => {
      const chunk = orm.get(index) ?? [];
      const space = [3, 3, 3, 4];

      return (
        <Row
          ref={ref}
          flexShrink={0}
          my={space}
          px={space}
          gapX={space}
          width="100%"
          height={linkSizePx}
        >
          {chunk.map((block) => {
            if (!block) {
              return (
                <LinkBlockInput size={linkSizePx} association={association} />
              );
            }
            const [i, node] = block;
            return typeof node.post === 'string' ? (
              <Col
                key={i.toString()}
                alignItems="center"
                justifyContent="center"
                height={linkSizePx}
                width={linkSizePx}
              >
                <Text>This link has been deleted</Text>
              </Col>
            ) : (
              <LinkBlockItem
                key={i.toString()}
                size={linkSizePx}
                node={node}
                summary
              />
            );
          })}
        </Row>
      );
    }),
    [orm, linkSizePx]
  );

  return (
    <Col
      width="100%"
      overflowX="hidden"
      overflowY="auto"
      height="calc(100% - 48px)"
      {...bind}
    >
      <BlockScroller
        origin="top"
        offset={0}
        style={style}
        data={orm}
        averageHeight={100}
        size={orm.size}
        pendingSize={0}
        renderer={renderItem}
        loadRows={() => Promise.resolve(true)}
      />
    </Col>
  );
}
