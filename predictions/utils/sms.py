#!/usr/bin/env python

import sys
import time
import logging

from twilio.rest import Client

log = logging.getLogger(__name__)


class SMS():
    def __init__(self, num, account, token):
        self.twilio_num = num
        self.twilio_account = account
        self.twilio_token = token
        self.client = Client(self.twilio_account, self.twilio_token)
        self.__logged_in = True

    def relogin(self):
        """Pretty drastic situation to be calling this. Must have hit some errors."""
        log.info('re-logging in')
        # logout
        del self.client
        self.__logged_in = False

        # Pause before re-logging in
        time.sleep(1)

        # Now, re-create a Twilio object
        self.client = Client(self.twilio_account, self.twilio_token)
        self.__logged_in = True

    def send(self, num, text, maxtries=3):
        """Send a SMS message to 'num' with the message in 'text'
        Mainly a wrapper to be persistent about getting sms messages out successfully"""
        errors = 0
        sent = False
        while errors <= maxtries and not sent:
            # Do we need to re-login?
            #  I'm saying we do when we've hit 3 errors in a row.
            if (errors % 3) == 0 and errors:
                self.relogin()
            try:
                log.info('Sending %s the message "%s"', num, text)
                message = self.client.messages.create(to=num, from_=self.twilio_num, body=text)

                # Now loop and wait to see if the message got sent
                #   Will wait up to 15 seconds before re-sending
                for i in range(15):
                    # Twilio mandates to not send more than one message per second
                    time.sleep(1)

                    # Lets check on that status of that message
                    last_few_messages = self.client.messages.list(
                        to=num, from_=self.twilio_num, limit=3)
                    message_copy = [m for m in last_few_messages if m.sid == message.sid][0]
                    if message_copy.status in ('sent', 'delivered'):
                        log.debug('Successfully sent %s the message "%s"', num, text)
                        sent = True
                        break  # hurray

            except (Exception), e:
                log.exception('Problem sending SMS: %s' % (str(e)))
                errors += 1

    def get_messages(self, limit=10):
        """ Return a list of the latest messages.
        """
        return self.client.messages.list(limit=limit)

    def __del__(self):
        self.__logged_in = False
        del self.client


if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG)

    import ConfigParser
    config = ConfigParser.ConfigParser()
    config.read(['predictions.config', 'predictions/predictions.config'])
    if not config.has_section('Twilio'):
        print 'Could not get necessary Twilio token info from config. Exiting.'
        sys.exit(1)
    sms = SMS(config.get('Twilio', 'twilio_num'),
              config.get('Twilio', 'twilio_account'),
              config.get('Twilio', 'twilio_token'))

    phonenumber = sys.argv[1]
    # print 'Would have sent: %s' % ' '.join(sys.argv[2:])
    sms.send(phonenumber, ' '.join(sys.argv[2:]), maxtries=1)
