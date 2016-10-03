#!/usr/bin/env python

import sys
import urllib
import re

from lxml.html import fromstring, tostring

ODDS_URL = 'http://sportsdirect.usatoday.com/odds/usatoday/ncaaf.aspx'
TEAM_NICKS = {'OSU': 'Ohio State'}


def get_odds(home_vs_away):
    hometeam, awayteam = home_vs_away.split('_vs_')
    # Could be using a nickname for a team which the ODDs site doesn't use.
    hometeam = TEAM_NICKS.get(hometeam, hometeam)
    awayteam = TEAM_NICKS.get(awayteam, awayteam)

    content = urllib.urlopen(ODDS_URL).read()
    doc = fromstring(content)
    #doc.make_links_absolute(url)

    scs = doc.find_class("small-copy-sans")
    team_td = [ td for td in scs if td.text == hometeam][0]
    teamline = team_td.getparent().getparent().getparent().getparent().getparent()

    both_teams = team_td.getparent().getparent().getchildren()
    both_teams_t = [ t.getchildren()[0].text for t in both_teams ]
    other_team = filter(lambda x: x != hometeam, both_teams_t)[0]
    if other_team != awayteam:
        raise '<p>Can not find odds for %s vs %s</p>' % (hometeam, awayteam)
    else:
        return re.sub('bgcolor="[^"]*"', '', tostring(teamline))


if __name__ == '__main__':

    print get_odds(sys.argv[1])
    sys.exit(0)

    # pass a game matchup like the URLs such as Wisconsin_vs_OSU
    import memcache
    mc = memcache.Client(['127.0.0.1:11211'], debug=0)
    key = '%s-ODDS' % (sys.argv[1])
    odds_html = mc.get(key)
    if not odds_html:
        odds_html = get_odds(sys.argv[1])
        mc.set(key, odds_html)

    print odds_html
