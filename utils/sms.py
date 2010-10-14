#!/usr/bin/env python

import os, sys, time
from googlevoice import Voice
from googlevoice.util import input

class SMS():
    def __init__(self, debug=0):
        self.debug = debug
        self.voice = Voice()
        self.voice.login()
        self.__logged_in = True

    def relogin(self):
        """Pretty drastic situation to be calling this. Must have hit some errors."""
        # start by killing our voice obj and completely re-initializing
        if self.debug: print 'DEBUG: logging out in efforts to reset things'
        if self.__logged_in:
            self.voice.logout()
            self.__logged_in = False
        del self.voice

        # Dunno why you have called this, but interjecting a sleep is probably good
        if self.debug: print 'DEBUG: sleep for 3'
        time.sleep(3)

        # Now, grab a new voice object and login.
        if self.debug: print 'DEBUG: relogging in.'
        self.voice = Voice()
        self.voice.login()
        self.__logged_in = True

    def send(self, num, text, maxtries=10):
        """Send a SMS message to 'num' with the message in 'text'
        Mainly a wrapper to be persistent about getting sms messages out successfully"""
        errors = 0
        while errors <= maxtries:
            # Do we need to re-login?
            #  I'm saying we do when we've hit 3 errors in a row.
            if (errors % 3) == 0 and errors:
                self.relogin()
            try:
                if self.debug: print 'DEBUG: Sending %s the message "%s"' % (num, text)
                self.voice.send_sms(num, text)
                break # hurray
            except (Exception), e:
                errors += 1

    def __del__(self):
        if self.__logged_in:
            self.voice.logout()
            self.__logged_in = False
        del self.voice
        if self.debug: print 'goodbye'

if __name__ == '__main__':

    phonenumber = sys.argv[1]
    sms = SMS(debug=1)
    for i in range(10):
        sms.send(phonenumber, 'Test msg #%d from sms.py' % (i))
    del sms
