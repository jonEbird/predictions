#!/usr/bin/env python

import os, sys, time
from datetime import datetime
from twilio.rest import TwilioRestClient

class SMS():
    def __init__(self, num, account, token, debug=0):
        self.twilio_num = num
        self.twilio_account = account
        self.twilio_token = token
        self.debug = debug
        self.client = TwilioRestClient(account=self.twilio_account, token=self.twilio_token)
        self.__logged_in = True

    def relogin(self):
        """Pretty drastic situation to be calling this. Must have hit some errors."""
        if self.debug: print 'DEBUG: logging out in efforts to reset things'
        # logout
        del self.client
        self.__logged_in = False

        # Dunno why you have called this, but interjecting a sleep is probably good
        if self.debug: print 'DEBUG: sleep for 3'
        time.sleep(1)

        # Now, re-create a Twilio object
        if self.debug: print 'DEBUG: relogging in.'
        self.client = TwilioRestClient(account=self.twilio_account, token=self.twilio_token)
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
                if self.debug: print 'DEBUG: Sending %s the message "%s"' % (num, text)
                message = self.client.sms.messages.create(to=num, from_=self.twilio_num, body=text)

                # Now loop and wait to see if the message got sent
                #   Will wait up to 15 seconds before resending
                for i in range(15):
                    # Twilio mandates to not send more than one message per second
                    time.sleep(1)

                    # Lets check on that status of that message
                    message_copy = [ m for m in self.client.sms.messages.list(to=num, from_=self.twilio_num) if m.name == message.name ][0]
                    if message_copy.status == u'sent':
                        if self.debug:
                            print 'Successfully sent %s the message "%s"' % (num, text)
                        sent = True
                        break # hurray

            except (Exception), e:
                if self.debug: print 'DEBUG: Problem sending SMS: %s' % (str(e))
                errors += 1

    def get_messages(self):
        """ Return a list of the latest messages.
        """
        return self.client.sms.messages.list()

    def __del__(self):
        self.__logged_in = False
        del self.client
        if self.debug: print 'goodbye'

if __name__ == '__main__':

    phonenumber = sys.argv[1]
    sms = SMS(debug=1)
    for i in range(10):
        sms.send(phonenumber, 'Test msg #%d from sms.py' % (i))
    del sms
