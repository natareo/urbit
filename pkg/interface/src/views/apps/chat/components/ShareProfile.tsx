import { BaseImage, Box, Row, Text } from '@tlon/indigo-react';
import { allowGroup, allowShips, Contact, share } from '@urbit/api';
import React, { ReactElement } from 'react';
import { Sigil } from '~/logic/lib/sigil';
import { uxToHex } from '~/logic/lib/util';
import airlock from '~/logic/api';

interface ShareProfileProps {
  our?: Contact;
  recipients: string | string[];
  onShare: () => void;
}

const ShareProfile = (props: ShareProfileProps): ReactElement | null => {
  const { recipients } = props;

  const image = (props?.our?.avatar)
  ? (
    <BaseImage
      src={props.our.avatar}
      width='24px'
      height='24px'
      borderRadius={2}
      style={{ objectFit: 'cover' }}
    />
  ) : (
    <Row
      p={1}
      alignItems="center"
      borderRadius={2}
      backgroundColor={props.our ? `#${uxToHex(props.our.color)}` : '#000000'}
    >
      <Sigil
        ship={window.ship}
        size={16}
        color={props.our ? `#${uxToHex(props.our.color)}` : '#000000'}
        icon
      />
    </Row>
  );

  const onClick = async () => {
    if(typeof recipients === 'string') {
      const [,,ship,name] = recipients.split('/');
      await airlock.poke(allowGroup(ship, name));
      if(ship !== `~${window.ship}`) {
        await airlock.poke(share(ship));
      }
    } else if(recipients.length > 0) {
      await airlock.poke(allowShips(recipients));
      await Promise.all(recipients.map(r => airlock.poke(share(r))));
    }
    props.onShare();
  };

  return props.recipients?.length > 0 ? (
    <Row
      height="48px"
      alignItems="center"
      justifyContent="space-between"
      borderBottom={1}
      borderColor="lightGray"
      flexShrink={0}
    >
      <Row pl={3} alignItems="center">
        {image}
        <Text verticalAlign="middle" pl={2}>Share private profile?</Text>
      </Row>
      <Box pr={2} onClick={onClick}>
        <Text color="blue" bold cursor="pointer">Share</Text>
      </Box>
    </Row>
  ) : null;
};

export default ShareProfile;
