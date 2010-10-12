#!/usr/bin/env python

import os, sys, urllib
from lxml.html import fromstring, tostring

ODDS_URL = 'http://sportsdirect.usatoday.com/odds/usatoday/ncaaf.aspx'

def get_odds(team):
    content = urllib.urlopen(ODDS_URL).read()
    doc = fromstring(content)
    #doc.make_links_absolute(url)

    scs = doc.find_class("small-copy-sans")
    team_td = [ el for el in scs if el.text == team][0]
    teamline = team_td.getparent().getparent().getparent().getparent().getparent()

    return tostring(teamline)

if __name__ == '__main__':

    #content = urllib.urlopen(url).read()
    #content = open(sys.argv[1]).read()

    print get_odds(sys.argv[1])
