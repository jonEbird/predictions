#!/bin/env python

import os, sys, ConfigParser, smtplib, traceback, shutil, tempfile
from datetime import datetime, timedelta
from math import sqrt, pow

abspath = os.path.dirname(__file__)
sys.path.append(abspath)
if abspath: os.chdir(abspath)
import web
from model import *
from utils.ncaa_odds import *
from utils.sms import *
from utils.profile import *
from urllib import quote
from email.mime.text import MIMEText

#-Configs------------------------------------------
defaults = { 'mpass': 'bingo', 'mode': 'dev',
             'EMAILADDR': 'jon@buckeyepredictions.com',
             'HTTPHOST': 'localhost/predictions',
             }
config = ConfigParser.ConfigParser(defaults = defaults)
config.read(['predictions.config', 'predictions/predictions.config'])
if not config.has_section('Predictions') or not config.has_section('Testing'):
    print "Error: Need to configure [predictions/]predictions.config with at least 'Predictions' and 'Testing' sections."
    sys.exit(-1)

#-Web----------------------------------------------

urls = (
    '/([^/]*)/', 'GamesURL',
    '/([^/]*)/profile/([^/]*)/', 'ProfileURL', # group, name
    '/([^/]*)/([^/]*)/', 'PredictionsURL',
    '/([^/]*)/([^/]*)/final', 'FinalscoreURL',
    '/([^/]*)/([^/]*)/([^/]*)/', 'PredictURL',
    '/([^/]*)/creategame/(.*)/(.*)/(.*)/(.*)/(.*)/(.*)/(.*)', 'CreategameURL',
    '/([^/]*)/admin', 'AdminURL',
    '/([^/]*)/email', 'EmailURL',
    '/([^/]*)/mugs', 'Mugs',
)
render = web.template.render('templates/')

def custom_msg(msg, person):
    msg_custom = msg
    msg_custom = msg_custom.replace('%{name}', person.name)
    msg_custom = msg_custom.replace('%{name_url}', quote(person.name))
    msg_custom = msg_custom.replace('%{nickname}', person.nickname)
    msg_custom = msg_custom.replace('%{password}', person.password)
    msg_custom = msg_custom.replace('%{betting}', 'coffee better' if person.betting else 'funsie')
    return msg_custom

def dateparse(date):
    formats = ('%Y-%m-%d %H:%M', '%m/%d/%y %H:%M', '%Y-%m-%dT%H:%M:%SZ')
    t = None
    for format in formats:
        try:
            t = datetime.strptime(date, format)
            break
        except (Exception), e:
            continue
    return t

def game_info(group, home_vs_away, season=current_season()):
    """Returns useful Game object with the following objects available:
    - done (boolean) - Is the game over?
    - started (boolean) - Has it started?
    - showpredictions (boolean) - Okay to show predictions?
    - url (string) - Fully qualified URL for the game.
    - stats (dict) - Keys 'mean', 'stddev', 'penalty'
    - people (list) - Sorted based on the winner with ties being handled. Extra objects include:
        - predicted (boolean) - Has this person made their prediction yet?
        - delta (int) - How far off from the exact score was their prediction.
        - home (int), away (int) - The predictions for the home and away team scores.
    """
    try:
        game = getgamebyversus(home_vs_away, season)
        game.done = (game.hscore != -1)

        now =  datetime.now()
        game.started = now > game.gametime

        game.url = 'http://%s/%s/%s_vs_%s/?season=%s' % \
            (config.get('Predictions', 'HTTPHOST'), group, quote(game.hometeam), quote(game.awayteam), season)

        predictions = getpredictions(group, game)
        for i in range(len(predictions)):
            p = predictions[i]
            p.delta = abs(game.hscore - p.home) + abs(game.ascore - p.away)
            p.predicted = True
            # Other attributes I'd typically want like the person
            p.name        = p.person.name
            p.nickname    = p.person.nickname
            p.email       = p.person.email
            p.phonenumber = p.person.phonenumber
            p.password    = p.person.password
            p.mugshot     = p.person.mugshot
            p.betting     = p.person.betting
            # Reassign
            predictions[i] = p

        # Statistics
        game.stats = {}
        game.stats['mean']    = sum([ p.delta for p in predictions ]) / len(predictions)
        game.stats['stddev']  = int(sqrt(sum([ pow(p.delta - game.stats['mean'], 2) for p in predictions ]) / len(predictions)))
        game.stats['penalty'] = int(game.stats['mean'] + game.stats['stddev'])

        # Now grab any undecided people
        undecided = getundecided(group, game)
        # Knowing the undecided results, we can now accurately determine if it is safe to show the predictions
        game.showpredictions = (now > game.gametime) or not undecided or game.done
        # Now onto adding the expected attributes to these entries as well
        for i in range(len(undecided)):
            p = undecided[i]
            p.delta = game.stats['penalty']
            p.home = -1
            p.away = -1
            p.predicted = False
            undecided[i] = p

        people = predictions + undecided

        # Initial sorting, then we handle the tie breaks
        people.sort(cmp=lambda a, b: cmp(a.delta,b.delta))

        game.people = people

        return game

    except (Exception), e:
        raise e

def sms_message(group, msg):
    """Craft a note to be SMS'ed to everyone. Some smart substitutions can occur such as:
       %{name}     = name from DB
       %{name_url} = name from DB urllib.quote'd
       %{nickname} = nickname from DB
    """
    if not config.has_section('Twilio'):
        return
    sms = SMS(config.get('Twilio', 'twilio_num'), config.get('Twilio', 'twilio_account'), config.get('Twilio', 'twilio_token'), debug=1)
    for person in getpeople(group, current_season()):
        if config.get('Predictions', 'mode') == 'dev' and person.name != config.get('Testing', 'testing_name'): continue
        sms.send(person.phonenumber, custom_msg(msg, person))
    del sms

def email_message(group, subject, msg):
    """Craft a note to be emailed to everyone. Some smart substitutions can occur such as:
       %{name}     = name from DB
       %{name_url} = name from DB urllib.quote'd
       %{nickname} = nickname from DB
    """
    for person in getpeople(group, current_season()):
        if config.get('Predictions', 'mode') == 'dev' and person.name != config.get('Testing', 'testing_name'): continue

        me = config.get('Predictions', 'EMAILADDR')
        toaddr = person.email.split(',')

        mailmsg = MIMEText(custom_msg(msg, person))
        mailmsg['Subject'] = custom_msg(subject, person)
        mailmsg['From'] = me
        mailmsg['To'] = person.email

        s = smtplib.SMTP()
        s.connect('localhost', 25)
        s.sendmail(me, toaddr, mailmsg.as_string())
        s.quit()

def sms_reminder(group):
    now =  datetime.now()
    midnight_tomorrow = datetime(*[ int(x) for x in (now + timedelta(hours=24)).strftime('%Y %m %d 23 59').split()])
    #datetime(*[ int(x) for x in (game.gametime - timedelta(hours=24)).strftime('%Y %m %d 12 0').split()])

    # Going to bug people differently based on the time of the day prior to the gameday.
    # i.e start SMS'ing people at noon, harassing by 3pm and full out barrage by 5pm
    nags = [ (17, 'OMFG! Is it really 5pm. Get off your ass.'),
             (15, 'Seriously, people are waiting on you.'),
             (12, 'Okay man, you should read your email.')]
    message = ''
    for H, msg in nags:
        if now.hour >= H:
            message = msg
            break

    if message and config.has_section('Twilio'):
        sms = SMS(config.get('Twilio', 'twilio_num'), config.get('Twilio', 'twilio_account'), config.get('Twilio', 'twilio_token'), debug=1)
        for game in Games.query.filter(and_(Games.gametime < midnight_tomorrow, Games.gametime > now)).all():

            undecided = getundecided(group, game)

            GAME_URL = 'http://%s/%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), group, quote(game.hometeam), quote(game.awayteam))

            for person in undecided:
                if config.get('Predictions', 'mode') == 'dev' and person.name != config.get('Testing', 'testing_name'): continue

                #print 'sms.send(%s, %s)' % (person.phonenumber, '%s %s%s/' % (message, GAME_URL, quote(person.name)) )
                sms.send(person.phonenumber, '%s %s%s/' % (message, GAME_URL, quote(person.name)) )

        del sms

def email_reminder(group):
    """Email the whole group with the predictions on the game. Do not call this if all of the predictions are not in yet."""
    try:
        now =  datetime.now()
        midnight_tomorrow = datetime(*[ int(x) for x in (now + timedelta(hours=24)).strftime('%Y %m %d 23 59').split()])
        for game in Games.query.filter(and_(Games.gametime < midnight_tomorrow, Games.gametime > now)).all():

            undecided = getundecided(group, game)

            GAME_URL = 'http://%s/%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), group, quote(game.hometeam), quote(game.awayteam))

            if undecided:
                for pdt in getpredictions(group, game):
                    person = pdt.person
                    if config.get('Predictions', 'mode') == 'dev' and person.name != config.get('Testing', 'testing_name'): continue

                    body = """
Thank you for getting your prediction in. You're a true fan.

As a reminder, you put %s(%d) - %s(%d)
If you need to update it, you still can at %s%s/

But what I really need from you is to help bug the people who haven't put their predictions in yet.
Please go nag:
  %s

Thank you,
The Gamemaster.
""" % (game.hometeam, pdt.home, game.awayteam, pdt.away, GAME_URL, quote(person.name), ', '.join([ p.name for p in undecided ]))

                    me = config.get('Predictions', 'EMAILADDR')
                    toaddr = person.email.split(',')

                    msg = MIMEText(body)
                    msg['Subject'] = 'Thank you for your prediction on the %s vs. %s Game?' % (game.hometeam, game.awayteam)
                    msg['From'] = me
                    msg['To'] = person.email

                    s = smtplib.SMTP()
                    s.connect()
                    s.sendmail(me, toaddr, msg.as_string())
                    s.quit()

            for person in undecided:
                if config.get('Predictions', 'mode') == 'dev' and person.name != config.get('Testing', 'testing_name'): continue

                body = """
Need to get your prediction in for the %s vs. %s game.

Go to %s%s/

We use this site for the spread - http://sportsdirect.usatoday.com/odds/usatoday/ncaaf.aspx
But you will already find the odds included on the prediction page for your convenience.

And good luck,
The Gamemaster.'
""" % (game.hometeam, game.awayteam, GAME_URL, quote(person.name))

                me = config.get('Predictions', 'EMAILADDR')
                toaddr = person.email.split(',')

                msg = MIMEText(body)
                msg['Subject'] = 'What is your Prediction on the %s vs. %s Game?' % (game.hometeam, game.awayteam)
                msg['From'] = me
                msg['To'] = person.email

                s = smtplib.SMTP()
                s.connect()
                s.sendmail(me, toaddr, msg.as_string())
                s.quit()

    except (Exception), e:
        print 'Sorry. Something happened while trying to email: %s' % (str(e))

def email_predictions(group, home_vs_away):
    """Email the whole group with the predictions on the game. Do not call this if all of the predictions are not in yet."""
    try:
        game = getgamebyversus(home_vs_away, current_season())
        predictions = getpredictions(group, game)

        body = 'Predictions are in!\n\n%s - %s\n' % (game.hometeam, game.awayteam)
        body += '\n'.join([ '%-2d - %-2d by %s' % (p.home, p.away, p.person.name) for p in predictions ])
        body += '\n\nGood luck, folks.'

        msg = MIMEText(body)
        msg['Subject'] = 'Predictions on the %s vs. %s Game' % (game.hometeam, game.awayteam)
        msg['From'] = config.get('Predictions', 'EMAILADDR')
        msg['To']   = config.get('Predictions', 'EMAILADDR')
        if config.get('Predictions', 'mode') == 'dev':
            bcc = [config.get('Testing', 'testing_email')]
        else:
            bcc = (','.join([ pdt.person.email for pdt in predictions ])).split(',')

        s = smtplib.SMTP()
        s.connect()
        s.sendmail(config.get('Predictions', 'EMAILADDR'), bcc, msg.as_string())
        s.quit()

    except (Exception), e:
        print 'Sorry. Something happened while trying to email: %s' % (str(e))

def sms_gameresults(group, home_vs_away):
    try:
        game = getgamebyversus(home_vs_away, current_season())
        game.done = (game.hscore != -1)

        predictions = getpredictions(group, game)
        for i in range(len(predictions)):
            p = predictions[i]
            p.delta = abs(game.hscore - p.home) + abs(game.ascore - p.away)
            p.person.winningcoffee = False
            predictions[i] = p
        predictions.sort(cmp=lambda a, b: cmp(a.delta,b.delta))
        winner = predictions[0]
        ties = [ pdt.person.name for pdt in predictions if pdt.delta == winner.delta ]
        # coffee gamblers
        betters = [ pdt for pdt in predictions if pdt.person.betting ]
        coffee_ties = [] # In case you have no betters
        if betters:
            coffee_delta = betters[0].delta
            for i in range(len(betters)):
                p = betters[i]
                if p.delta == coffee_delta:
                    p.person.winningcoffee = True
                betters[i] = p
            coffee_ties = [ pdt.person for pdt in betters if pdt.delta == coffee_delta ]
        coffee_names = ' & '.join([ p.name for p in coffee_ties ])

        if not config.has_section('Twilio'):
            return
        sms = SMS(config.get('Twilio', 'twilio_num'), config.get('Twilio', 'twilio_account'), config.get('Twilio', 'twilio_token'), debug=1)

        for pdt in predictions:
            person = pdt.person
            if config.get('Predictions', 'mode') == 'dev' and person.name != config.get('Testing', 'testing_name'):
                continue

            if len(ties) > 1:
                if person.name in ties:
                    text = 'Lucky SOB. You and %s win by tying at being %d off!' % (' & '.join([ o for o in ties if o != person.name]), winner.delta)
                else:
                    text = 'A tie! %s win being %d off. You were %d off, loser.' % (' & '.join(ties), winner.delta, pdt.delta)
            else:
                if person == winner.person:
                    text = 'Lucky SOB, you win by being off by %d!' % (pdt.delta)
                else:
                    text = '%s wins being %d off. You were %d off, loser.' % (winner.person.name, winner.delta, pdt.delta)
            # Add the coffee winners and game URL
            if person in coffee_ties:
                text += ' Go collect your coffee winnings.'
            elif person.betting:
                text += ' You owe %s coffee.' % coffee_names
            text += ' http://%s/%s/%s/' % (config.get('Predictions', 'HTTPHOST'), group, home_vs_away)

            print 'DEBUG: Sending "%s" at %s message: "%s"' % (pdt.person.name, str(pdt.person.phonenumber), text)
            sms.send(pdt.person.phonenumber, text)

        del sms

    except (Exception), e:
        raise e
        #print 'Sorry. You probably are looking for another game?\nPsst: %s' % (str(e))

def print_sms_messages():
    sms = SMS(config.get('Twilio', 'twilio_num'), config.get('Twilio', 'twilio_account'), config.get('Twilio', 'twilio_token'), debug=1)
    num2name = dict([ ('+1%s' % p.phonenumber, p.name) for p in Person.query.all() ])
    stat_n, stat_tot = 0, 0.0
    for m in sms.get_messages():
        date_created = datetime.strptime(m.date_created, '%a, %d %b %Y %H:%M:%S +%f')
        date_sent    = datetime.strptime(m.date_sent,    '%a, %d %b %Y %H:%M:%S +%f')
        date_updated = datetime.strptime(m.date_updated, '%a, %d %b %Y %H:%M:%S +%f')
        ts = (date_sent - date_created).total_seconds()
        # Stats
        stat_n   += 1
        stat_tot += ts

        print '%s sent to %s (%s) and completed %fs later:\n  "%s"' % \
            (date_created.strftime('%F %T'), num2name.get(m.to, 'Unknown'), m.to, ts, m.body)

    print '%d messages sent for an average of %fs to complete the message.' % (stat_n, stat_tot / stat_n)


class Mugs:
    def GET(self, group):
        i = web.input(season=current_season())
        people = getpeople(group, i.season)
        return render.mugs(people)

class ProfileURL:
    def GET(self, group, name):
        i = web.input(season=current_season())
        person = getperson(group, name, i.season)

        # You can change your profile: Picture, Nickname
        myform = web.form.Form(
            web.form.Textbox("Nickname", value=person.nickname),
            web.form.File("Mugshot"),
            web.form.Password('password', value=""),
            )

        msg = ''
        return render.profile(person, myform, msg)

    def POST(self, group, name):
        i = web.input(Mugshot={}, season=current_season())
        person = getperson(group, name, i.season)

        # Won't be doing much if the password is incorrect
        if not (person.password == i.password or i.password == config.get('Predictions', 'mpass')):
            msg = 'Wrong password. Try again'
            myform = web.form.Form(
                web.form.Textbox("Nickname", value=person.nickname),
                web.form.File("Mugshot"),
                web.form.Password('password', value=""),
                )
            return render.profile(person, myform, msg)

        # Lets start with the nickname
        if person.nickname != i.Nickname.strip():
            person.nickname = i.Nickname.strip()
            session.commit()

        # Now lets take a look at the picture
        if i.Mugshot.filename:
            tmpfile = tempfile.mktemp(prefix='predictions_')
            fh = open(tmpfile, 'w')
            fh.write(i.Mugshot.file.read())
            fh.close()

            if is_valid_picture(tmpfile):
                dst = os.path.join(config.get('Predictions', 'BASEDIR'), person.mugshot)
                shutil.copy(tmpfile, dst)
                # And now need to resize it
                os.system('convert %s -resize 300x300 %s' % (dst, dst))
            else:
                msg = 'Your new profile pic is not actually a pic. Try again.'
                myform = web.form.Form(
                    web.form.Textbox("Nickname", value=person.nickname),
                    web.form.File("Mugshot"),
                    web.form.Password('password', value=""),
                    )
                # clean up first, then redirect them
                os.unlink(tmpfile)
                return render.profile(person, myform, msg)

            # clean up
            os.unlink(tmpfile)

        return web.seeother('http://%s/%s/mugs' % (config.get('Predictions', 'HTTPHOST'), group))

class EmailURL:
    def POST(self, group):
        i = web.input(season=current_season())
        if i.password == config.get('Predictions', 'mpass'):
            email_message(group, i.subject, i.email)

        return web.seeother('http://%s/%s/admin' % (config.get('Predictions', 'HTTPHOST'), group))

class AdminURL:
    def GET(self, group):
        i = web.input(season=current_season())
        # games = Games.query.filter(Games.season==i.season).order_by(Games.gametime).all()
        groupplay = getgroup(group, i.season)
        betting = Betting.query.filter(Betting.group==groupplay).all()
        games = [ bet.game for bet in betting ]
        for i in range(len(games)):
            game = games[i]
            # first, it is over?
            game.done = (game.hscore != -1)
            # Now help out the templating engine
            game.ahref = '%s_vs_%s' % (game.hometeam, game.awayteam)
            games[i] = game

        # /creategame/OSU/Marshall/2010/9/2/19/30?auth=<password>
        myform = web.form.Form(
            web.form.Textbox("Home", value=""),
            web.form.Textbox("Away", value=""),
            web.form.Textbox("Datetime", value=""),
            web.form.Textbox("Season", value=current_season()),
            web.form.Password('password', value=""),
            )

        msg = ''
        return render.admin(group, games, myform, msg)

    def POST(self, group):
        i = web.input(auth="bogus", season=current_season())
        groupplay = getgroup(group, i.season)
        gametime = dateparse(i.Datetime)
        if not gametime:
            msg = 'Sorry. Could not parse the date of "%s". Try a format of: YYYY-MM-DD HH:MM (%s)' % (str(i.Datetime), str(gametime))
            betting = Betting.query.filter(Betting.group==groupplay).all()
            games = [ bet.game for bet in betting ]
            # games = Games.query.filter(Games.season==i.season).order_by(Games.gametime).all()
            for n in range(len(games)):
                game = games[n]
                # first, it is over?
                game.done = (game.hscore != -1)
                # Now help out the templating engine
                game.ahref = '%s_vs_%s' % (game.hometeam, game.awayteam)
                games[n] = game
            myform = web.form.Form(
                web.form.Textbox("Home", value=i.Home),
                web.form.Textbox("Away", value=i.Away),
                web.form.Textbox("Datetime", value=i.Datetime),
                web.form.Textbox("Season", value=current_season()),
                web.form.Password('password', value=""),
                )
            return render.admin(group, games, myform, msg)

        #print 'You want to pit %s against %s on %s via authorization "%s"?' % (home, away, gametime, input.auth)
        # FIXME: Should be checking the group's admin password here and perhaps OR'ing it with the 'mpass'
        if i.password == config.get('Predictions', 'mpass'):
            nextgame = Games(hometeam=i.Home, awayteam=i.Away, gametime=gametime, season=i.Season, hscore=-1, ascore=-1)
            betting  = Betting(game=nextgame, group=groupplay)
            session.commit()
            return web.seeother('http://%s/%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), group, quote(i.Home), quote(i.Away)))
        else:
            return 'Sorry, can not help you. That is not the right password.'

class GamesURL:
    def GET(self, group):
        i = web.input(season=current_season())
        selected_season = i.season
        now = datetime.now()
        charts = []
        # We care about three DB things for this page: Games, People, Predictions
        # 1. Games
        groupplay = getgroup(group, i.season)
        betting = Betting.query.filter(Betting.group==groupplay).all()
        games = [ bet.game for bet in betting ]
        # 2. People
        people = [ m.person for m in Membership.query.filter(Membership.group==groupplay).all() ]
        names = [ p.name for p in people ]
        pindex = dict([ (person.name, i) for i, person in enumerate(people) ])
        # some stats initialization
        for name, i in pindex.iteritems():
            person = people[i]
            person.tot_games = 0
            person.tot_delta = 0
            person.game_deltas = {} # dict of {game_index: delta}
            people[i] = person

        for i in range(len(games)):
            game = games[i]
            # first, it is over?
            td = now - game.gametime
            #game.done = (td.seconds + td.days * 24 * 3600) > 14400 # 4hours past gametime?
            game.done = (game.hscore != -1)
            # Now help out the templating engine
            game.ahref = '%s_vs_%s' % (game.hometeam, game.awayteam)
            if game.hometeam == 'OSU':
                game.opponent = game.awayteam
            else:
                game.opponent = game.hometeam
            games[i] = game

            # Update stats on completed games
            if not game.done:
                continue
            #predictions = game.predictions
            #predictions = [ p for p in game.predictions if p.group == groupplay ]
            predictions = Predictions.query.filter(and_(Predictions.group==groupplay, Predictions.game==game)).all()
            for j in range(len(predictions)):
                try:
                    pdt = predictions[j]
                    delta = abs(game.hscore - pdt.home) + abs(game.ascore - pdt.away)
                    pdt.delta = delta
                    name = pdt.person.name
                    person = people[pindex[name]]
                    person.tot_games += 1
                    person.tot_delta += delta
                    # For graphing purposes
                    person.game_deltas[i] = delta
                    # person
                    people[pindex[name]] = person
                    # set prediction
                    predictions[j] = pdt
                except (TypeError), e:
                    continue
            game.predictions = predictions

            predictions.sort(cmp=lambda a, b: cmp(a.delta,b.delta))
            winner = predictions[0]
            game.mugshots = [ pdt.person.mugshot for pdt in predictions if pdt.delta == winner.delta ]
            game.winningnames = ' & '.join([ pdt.person.name for pdt in predictions if pdt.delta == winner.delta ])

            # Ah, but what about the coffee betters and not the funsies?
            betters = [ pdt for pdt in predictions if pdt.person.betting ]
            coffee_winner = betters[0]
            if winner != coffee_winner:
                game.coffee_winningnames = ' & '.join([ pdt.person.name for pdt in betters if pdt.delta == coffee_winner.delta ])
            else:
                game.coffee_winningnames = ''

            # Statistics
            game.mean    = sum([ pdt.delta for pdt in predictions ]) / len(predictions)
            game.stddev  = int(sqrt(sum([ pow(pdt.delta - game.mean, 2) for pdt in predictions ]) / len(predictions)))
            game.penalty = int(game.mean + (game.stddev / 2))

            undecided = [ p for p in people if p.name not in [ pdt.person.name for pdt in predictions ] ]
            for dummy in undecided:
                person = people[pindex[dummy.name]]
                person.tot_games += 1
                person.tot_delta += game.penalty
                people[pindex[dummy.name]] = person

        people.sort(cmp=lambda a, b: cmp(a.tot_delta, b.tot_delta))
        #charts.append("""http://chart.apis.google.com/chart?chxl=0:|%s&chxr=0,0,%d&chds=0,%d&chxt=y,x&chbh=a,5&chs=300x225&cht=bhg&chco=A2C180&chd=t:%s&chtt=Total+Points+Off+in+All+Games&chts=EE2525,11.5""" % ( "|".join([ p.name.replace(' ', '+') for p in people.__reversed__()]), people[-1].tot_delta, people[-1].tot_delta, ','.join([ ('%d' % p.tot_delta) for p in people ]) ))

        charts.append("""http://chart.apis.google.com/chart?chxl=0:|%s&chxt=y,x&chxr=1,0,%d&chds=0,%d&chbh=a,5&chs=300x225&cht=bhg&chco=A2C180&chd=t:%s&chtt=Total+Points+Off+in+All+Games&chts=EE2525,11.5""" % ("|".join([ p.name.replace(' ', '+') for p in people.__reversed__()]), people[-1].tot_delta, people[-1].tot_delta, ','.join([ ('%d' % p.tot_delta) for p in people ])) )

        return render.games(games, people, names, pindex, charts, selected_season, get_seasons())

class PredictionsURL:
    def GET(self, group, home_vs_away):
        try:
            i = web.input(season=current_season())
            session.commit() # fixes caching?
            game = getgamebyversus(home_vs_away, i.season)
            groupplay = getgroup(group, i.season)
            predictions = Predictions.query.filter(and_(Predictions.group==groupplay, Predictions.game==game)).all()

            # Do I need to fetch the odds on the game?
            #  Shouldn't try to fetch before at least 4 days till game.
            now = datetime.now()
            if (game.gametime - now) < timedelta(days=4) and not game.odds:
                try:
                    odds_html = get_odds(home_vs_away)
                    game.odds = odds_html
                    session.commit()
                except (Exception), e:
                    pass

            # Need to know if the game has started or not. Also need to know if the game is done.
            game.started = now > game.gametime
            game.done = game.hscore != -1

            # Use the following query if you need to limit the scores show per Group
            # ingamescores = InGameScores.query.filter(and_(InGameScores.game==game, InGameScores.group==groupplay)).all()
            if game.done or (game.started and game.ingamescores):
                if game.done:
                    hscore = game.hscore
                    ascore = game.ascore
                else:
                    hscore = game.ingamescores[-1].home
                    ascore = game.ingamescores[-1].away

                for i in range(len(predictions)):
                    p = predictions[i]
                    p.delta = abs(hscore - p.home) + abs(ascore - p.away)
                    p.person.winningcoffee = False
                    predictions[i] = p
                predictions.sort(cmp=lambda a, b: cmp(a.delta,b.delta))
                betters = [ pdt for pdt in predictions if pdt.person.betting ]
                if betters:
                    coffee_delta = betters[0].delta
                    for i in range(len(betters)):
                        p = betters[i]
                        if p.delta == coffee_delta:
                            p.person.winningcoffee = True
                        betters[i] = p
                # Statistics
                game.mean    = sum([ pdt.delta for pdt in predictions ]) / len(predictions)
                game.stddev  = sqrt(sum([ pow(pdt.delta - game.mean, 2) for pdt in predictions ]) / len(predictions))
                game.penalty = int(game.mean + (game.stddev / 2))

            # FIXME: Don't really like this query but it's working...
            people = [ m.person for m in Membership.query.filter(Membership.group==groupplay).all() ]
            undecided = [ p for p in people if p.name not in [ pdt.person.name for pdt in predictions ] ]

            # Now, you can only see the predictions when all are in or the game has started.
            game.showpredictions = (datetime.now() > game.gametime) or not undecided or game.done

            return render.predictions(group, predictions, game, undecided)
        except (Exception), e:
            print 'print_exc():'
            traceback.print_exc(file=sys.stdout)
            return 'Sorry. You probably are looking for another game?\nPsst: %s' % (str(e))

    def POST(self, group, home_vs_away):
        try:
            i = web.input(season=current_season())
            groupplay = getgroup(group, i.season)

            # form data
            homescore = int(i.homescore)
            awayscore = int(i.awayscore)
            comment = i.comment[:100] # match the varchar length
            password = i.password

            # supplementary info
            session.commit() # fixes caching?
            person = Person.query.filter_by(password=password).one()
            game = getgamebyversus(home_vs_away, i.season)
            game.done = game.hscore != -1

            # Insert InGameScores commentary by our fellow player
            if not game.done:
                InGameScores(home=homescore, away=awayscore, comment=comment, person=person, game=game, group=groupplay)
                session.commit()

        except (Exception), e:
            return 'DEBUG: Got an error: %s' % (str(e))
            pass
        return web.seeother('http://%s/%s/%s/' % (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))

class CreategameURL:
    def GET(self, group, home, away, year, mon, day, hour, min):
        """Example URL would be /creategame/OSU/Marshall/2010/9/2/19/30?auth=<password>"""
        i = web.input(auth="bogus", season=current_season())
        gametime = datetime(int(year), int(mon), int(day), int(hour), int(min))
        #print 'You want to pit %s against %s on %s via authorization "%s"?' % (home, away, gametime, i.auth)
        if i.auth == config.get('Predictions', 'mpass'):
            nextgame = Game(hometeam=home, awayteam=away, gametime=gametime, hscore=-1, ascore=-1, season=i.season)
            session.commit()
            return web.seeother('http://%s/%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), group, home, away))
        else:
            return 'Sorry, can not help you.'

class FinalscoreURL:
    def GET(self, group, home_vs_away):
        try:
            i = web.input(season = current_season())
            hometeam, awayteam = home_vs_away.split('_vs_')

            myform = web.form.Form(
                web.form.Textbox(hometeam, value=""),
                web.form.Textbox(awayteam, value=""),
                web.form.Password('password', value=""),
                )

            return render.finalscore(hometeam, awayteam, myform, msg='')

        except (Exception), e:
            return 'Sorry. You\'re going to have to ssh into the machine to post the score.\nPsst: %s' % (str(e))

    def POST(self, group, home_vs_away):
        try:
            i = web.input(season = current_season())
            hometeam, awayteam = home_vs_away.split('_vs_')
            game = getgamebyversus(home_vs_away, i.season)

            if i.password == config.get('Predictions', 'mpass'):
                game.hscore = int(getattr(i,hometeam))
                game.ascore = int(getattr(i,awayteam))
                session.commit()

                # Send out a SMS message about the winners
                sms_gameresults(group, home_vs_away)

                return web.seeother('http://%s/%s/%s/' % (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))

            else:
                myform = web.form.Form(
                    web.form.Textbox(hometeam, value=getattr(i,hometeam)),
                    web.form.Textbox(awayteam, value=getattr(i,awayteam)),
                    web.form.Password('password', value=""),
                    )

                return render.finalscore(hometeam, awayteam, myform, msg='Wrong password. Try again.')

        except (Exception), e:
            return 'Seriously, you\'re going to have to ssh into the machine to post the score.\nPsst: %s' % (str(e))

class PredictURL:
    def GET(self, group, home_vs_away, name):
        try:
            #print 'Let\'s see what %s has to say about the %s game.' % (name, game)
            i = web.input(season=current_season())
            hometeam, awayteam = home_vs_away.split('_vs_')
            game = getgamebyversus(home_vs_away, i.season)
            # p = Person.query.filter_by(name=name).one()
            groupplay = getgroup(group, i.season)
            p = [ m.person for m in Membership.query.filter(Membership.group==groupplay).all() if m.person.name == name ][0]

            myform = web.form.Form(
                web.form.Textbox(hometeam, value=""),
                web.form.Textbox(awayteam, value=""),
                web.form.Password('password', value=""),
                )

            return render.predict(game, p, myform, msg='')
        except (Exception), e:
            return 'Sorry. You probably are looking for another game?\n%s' % (str(e))

    def POST(self, group, home_vs_away, name):
        i = web.input(auth="bogus", season=current_season())
        hometeam, awayteam = home_vs_away.split('_vs_')
        game = getgamebyversus(home_vs_away, i.season)
        groupplay = getgroup(group, i.season)
        p = [ m.person for m in Membership.query.filter(Membership.group==groupplay).all() if m.person.name == name ][0]

        # first of all, you can not make predictions when the game is on
        if datetime.now() > game.gametime:
            return web.seeother('http://%s/%s/%s/' % (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))

        # also, you can not make a prediction once all of the predictions are in.
        undecided = getundecided(group, game)
        if not undecided:
            return web.seeother('http://%s/%s/%s/' % (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))

        if p.password == i.password or i.password == config.get('Predictions', 'mpass'):
            # Is there already a prediction out there for this?
            q = Predictions.query.filter(and_(Predictions.group==groupplay, Predictions.game==game, Predictions.person==p))
            if q.count():
                pp = q.one()
                pp.home=int(getattr(i,hometeam))
                pp.away=int(getattr(i,awayteam))
            else:
                Predictions(home=int(getattr(i,hometeam)), away=int(getattr(i,awayteam)), dt=datetime.now(), person=p, game=game, group=groupplay)

            # all done here
            session.commit()

            # Was this the last prediction? Time to email the group?
            showpredictions = (datetime.now() > game.gametime) or (undecided == [ p ])
            if showpredictions:
                email_predictions(group, home_vs_away)

            return web.seeother('http://%s/%s/%s/' % (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))
        else:
            myform = web.form.Form(
                web.form.Textbox(hometeam, value=getattr(i,hometeam)),
                web.form.Textbox(awayteam, value=getattr(i,awayteam)),
                web.form.Password('password', value=""),
                )

            return render.predict(game, p, myform, msg='Wrong password. Try again.')

web.webapi.internalerror = web.debugerror
app = web.application(urls, globals(), autoreload=False)
application = app.wsgifunc()

if __name__ == "__main__":

    import argparse
    parser = argparse.ArgumentParser(description='Predictions Admin Utility')
    parser.add_argument('--group', required=True, help='Which group are we operating on?')
    parser.add_argument('--adduser', help='Create a new user', action='store_true', default=False)
    # Nugde people or send a normal message via SMS or Email
    parser.add_argument('--nudge', '--remind', dest='reminder', action='store_true', default=False,
                        help='Remind people to make a prediction (Pick a method)')
    parser.add_argument('--message', dest='message',
                        help='Send a message to the entire team via SMS or Email (Pick a method)')
    parser.add_argument('--method', dest='method', choices=['sms', 'email'],
                        help='Method to use when nudging contacting people')
    # Summation Actions
    parser.add_argument('--email_predictions', dest='email_predictions', action='store_true', default=False,
                        help='Send an email out with the predictions.')
    parser.add_argument('--sms_results', dest='sms_results', action='store_true', default=False,
                        help='Send a SMS to each member with the results of the game.')
    parser.add_argument('--teams', dest='home_vs_away', nargs=2,
                        help='Send a SMS to each member with the results of the game.')
    # Inquiry
    parser.add_argument('--list-sms', dest='list_sms', action='store_true', default=False,
                        help='Print out a summary of the last SMS messages sent.')
    # Debug
    parser.add_argument('--debug', dest='debug', action='store_true', default=False,
                        help='Debugging the arguments / actions.')
    args = parser.parse_args()
    # parser.parse_args('--group bucknuts'.split())

    if args.adduser:
        print "Adding a new user. I will prompt you for the necessary intel."
        name        = raw_input("  Full Name: ")
        nickname    = raw_input("  Nickame: ")
        email       = raw_input("  Email: ")
        phonenumber = raw_input("  Phone#: ")
        password    = raw_input("  Password: ")
        betting     = raw_input("  Betting?: (Y/n) ")

        newuser = Person(name=name, nickname=nickname, email=email, phonenumber=phonenumber, password=password, betting=betting.lower().startswith('y'))
        member  = Membership(person=newuser, group=getgroup(args.group))
        print 'Added.'
        session.commit()

    #elif (len(sys.argv) > 1 and sys.argv[1] in ['remind', 'nudge']):
    elif args.reminder and args.method:
        if args.method == 'email':
            if args.debug: print 'Debug: Reminder message via email.'
            email_reminder(args.group)
        else:
            if args.debug: print 'Debug: Reminder message via sms.'
            sms_reminder(args.group)

    #elif (len(sys.argv) == 3 and sys.argv[1] in ['summary']):
    elif args.email_predictions and args.home_vs_away:
        home, away = args.home_vs_away
        email_predictions(args.group, '%s_vs_%s' % (home, away))

    elif args.message and args.method:
        if args.method == 'email':
            body = sys.stdin.read().strip()
            if not body:
                print 'Need to pass the body of the message via STDIN'
            else:
                email_message(args.group, args.message, body)
        else:
            sms_message(args.group, args.message)

    #elif (len(sys.argv) == 3 and sys.argv[1] in ['sms_final', 'sms_gameresults']):
    elif args.sms_results and args.home_vs_away:
        home, away = args.home_vs_away
        sms_gameresults(args.group, '%s_vs_%s' % (home, away))

    elif args.list_sms:
        print_sms_messages()

    # app.run()
