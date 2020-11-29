#!/usr/bin/env python

import os
import sys
import ConfigParser
import smtplib
import traceback
import shutil
import tempfile
import random
import logging

from datetime import datetime, timedelta
from math import sqrt, pow
from urllib import quote
from email.mime.text import MIMEText

abspath = os.path.dirname(__file__)
sys.path.append(abspath)
if abspath:
    os.chdir(abspath)

import web

from model import *
from utils.ncaa_odds import *
from utils.sms import *
from utils.profile import *

#-Configs------------------------------------------
defaults = { 'mpass': 'bingo', 'mode': 'dev',
             'EMAILADDR': 'jon@buckeyepredictions.com',
             'HTTPHOST': 'localhost/predictions',
             }
config = ConfigParser.ConfigParser(defaults=defaults)
config.read(['predictions.config', 'predictions/predictions.config'])
if not config.has_section('Predictions') or not config.has_section('Testing'):
    print "Error: Need to configure [predictions/]predictions.config with at least 'Predictions' and 'Testing' sections."
    sys.exit(-1)

#-Web----------------------------------------------

urls = (
    '/([^/]*)/', 'GamesURL',
    '/([^/]*)/profile/([^/]*)/', 'ProfileURL',  # group, name
    '/([^/]*)/([^/]*)/', 'PredictionsURL',
    '/([^/]*)/([^/]*)/final', 'FinalscoreURL',
    '/([^/]*)/([^/]*)/([^/]*)/', 'PredictURL',
    '/([^/]*)/admin', 'AdminURL',
    '/([^/]*)/email', 'EmailURL',
    '/([^/]*)/mugs', 'Mugs',
)
render = web.template.render('templates/')


def utf8(s):
    """Return a unicode version of input s"""
    if isinstance(s, unicode):
        return s.encode('utf-8')
    # if isinstance(s, bytes):
    #     return s.decode("utf-8")
    return s


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
        except (Exception):
            continue
    return t


def game_info(group, home_vs_away, season=current_season()):
    """Returns useful Game object with the following objects available:
    - done (boolean) - Is the game over?
    - started (boolean) - Has it started?
    - display (boolean) - Has betting begun?
    - showpredictions (boolean) - Okay to show predictions?
    - url (string) - Fully qualified URL for the game.
    - stats (dict) - Keys 'mean', 'stddev', 'penalty'
    - people (list) - Sorted based on the winner with ties being handled. Extra objects include:
        - predicted (boolean) - Has this person made their prediction yet?
        - picked_winner (boolean) - Did you pick the correct team to win?
        - winningcoffee (boolean) - Does this person win coffee?
        - delta (int) - How far off from the exact score was their prediction.
        - home (int), away (int) - The predictions for the home and away team scores.
    """
    try:
        game = getgamebyversus(home_vs_away, season)
        game.done = (game.hscore > -1)
        game.canceled = game.hscore == 0 and game.ascore == 0

        now = datetime.now()
        game.started = now > game.gametime

        game.display = (game.hscore == -1)

        game.url = 'http://%s/%s/%s_vs_%s/?season=%s' % \
            (config.get('Predictions', 'HTTPHOST'), group,
             quote(game.hometeam), quote(game.awayteam), season)

        predictions = getpredictions(group, game)
        for i in range(len(predictions)):
            p = predictions[i]
            if game.done:
                p.delta = abs(game.hscore - p.home) + abs(game.ascore - p.away)
            elif game.ingamescores:
                igs = game.ingamescores[-1]
                p.delta = abs(igs.home - p.home) + abs(igs.away - p.away)
            else:
                p.delta = 0
            p.predicted = True
            # Defaults
            p.winningcoffee = False
            # Picked the correct team?
            if game.hscore > game.ascore:
                p.picked_winner = p.home > p.away
            else:
                p.picked_winner = p.home < p.away
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
        game.stats = {'mean': 0, 'stddev': 0, 'penalty': 20 }
        if predictions:
            game.stats['mean']    = sum([ pd.delta for pd in predictions ]) / len(predictions)
            game.stats['stddev']  = int(sqrt(sum([ pow(pd.delta - game.stats['mean'], 2)
                                                   for pd in predictions ]) / len(predictions)))
            game.stats['penalty'] = int(game.stats['mean'] + (game.stats['stddev'] / 2))

        # Now grab any undecided people
        undecided = getundecided(group, game)
        # Knowing the undecided results, we can now accurately determine if
        # it is safe to show the predictions
        game.showpredictions = (now > game.gametime) or not undecided or game.done
        # Now onto adding the expected attributes to these entries as well
        for i in range(len(undecided)):
            p = undecided[i]
            p.delta = game.stats['penalty']
            p.home = -1
            p.away = -1
            p.predicted = False
            p.picked_winner = False
            # Defaults
            p.winningcoffee = False
            undecided[i] = p
        game.undecided = undecided  # used for boolean or iteration

        # Initial sorting, then we handle the tie breaks
        def prediction_cmp(p1, p2):
            """Function used for sorting out who did better than the other person.
            Returns -1, 0, or 1 as a cmp function should.
            """
            if p1.delta < p2.delta:
                return -1
            elif p1.delta > p2.delta:
                return 1
            elif p1.delta == p2.delta:
                # Rule 1: Did you pick the wrong team?
                if p1.picked_winner and not p2.picked_winner:
                    return -1
                elif not p1.picked_winner and p2.picked_winner:
                    return 1
                # Rule 2: Did anyone predict the winning score exactly correct?
                if game.hscore > game.ascore:  # home team won
                    if p1.home == game.hscore and p2.home != game.hscore:
                        return -1
                    elif p1.home != game.hscore and p2.home == game.hscore:
                        return 1
                else:  # away team won
                    if p1.away == game.ascore and p2.away != game.ascore:
                        return -1
                    elif p1.away != game.ascore and p2.away == game.ascore:
                        return 1
                # Rule 3: How about the losing team's score exactly?
                if game.hscore > game.ascore:  # home team won
                    if p1.away == game.ascore and p2.away != game.ascore:
                        return -1
                    elif p1.away != game.ascore and p2.away == game.ascore:
                        return 1
                else:  # away team won
                    if p1.home == game.hscore and p2.home != game.hscore:
                        return -1
                    elif p1.home != game.hscore and p2.home == game.hscore:
                        return 1
                # Rule 4: Who more closely predicted the winning team's score?
                if game.hscore > game.ascore:  # home team won
                    if abs(game.hscore - p1.home) < abs(game.hscore - p2.home):
                        return -1
                    elif abs(game.hscore - p1.home) > abs(game.hscore - p2.home):
                        return 1
                else:  # away team won
                    if abs(game.ascore - p1.away) < abs(game.ascore - p2.away):
                        return -1
                    elif abs(game.ascore - p1.away) > abs(game.ascore - p2.away):
                        return 1
                # Rule 5: Who more closely predicted the losing team's score?
                if game.hscore > game.ascore:  # home team won
                    if abs(game.ascore - p1.away) < abs(game.ascore - p2.away):
                        return -1
                    elif abs(game.ascore - p1.away) > abs(game.ascore - p2.away):
                        return 1
                else:  # away team won
                    if abs(game.hscore - p1.home) < abs(game.hscore - p2.home):
                        return -1
                    elif abs(game.hscore - p1.home) > abs(game.hscore - p2.home):
                        return 1
                # Rule 6: Fine! Who put their prediction in first?
                # Well, in this case, do not change the order... already in prediction order.
                return 0

        people = predictions + undecided

        # Sort people based on their prediction and take into account tie breakers
        if game.ingamescores or game.done:
            people.sort(cmp=prediction_cmp)

        # Final piece of business is deciding who wins coffee
        betters_index = [ i for (i, person) in enumerate(people) if person.betting ]
        if betters_index and not game.canceled:
            people[betters_index[0]].winningcoffee = True

        game.people = people

        return game

    except (Exception), e:
        traceback.print_exc()
        raise e


def sms_message(group, msg):
    """Craft a note to be SMS'ed to everyone. Some smart substitutions can occur such as:
       %{name}     = name from DB
       %{name_url} = name from DB urllib.quote'd
       %{nickname} = nickname from DB
    """
    if not config.has_section('Twilio'):
        return
    sms = SMS(config.get('Twilio', 'twilio_num'),
              config.get('Twilio', 'twilio_account'),
              config.get('Twilio', 'twilio_token'))
    for person in getpeople(group, current_season()):
        if config.get('Predictions', 'mode') == 'dev' and \
           person.name != config.get('Testing', 'testing_name'):
            continue
        sms.send(person.phonenumber, custom_msg(msg, person))
    del sms


def email_message(group, subject, msg):
    """Craft a note to be emailed to everyone. Some smart substitutions can occur such as:
       %{name}     = name from DB
       %{name_url} = name from DB urllib.quote'd
       %{nickname} = nickname from DB
    """
    for person in getpeople(group, current_season()):
        if config.get('Predictions', 'mode') == 'dev' and \
           person.name != config.get('Testing', 'testing_name'):
            continue

        me = config.get('Predictions', 'EMAILADDR')
        toaddr = person.email.split(',')

        mailmsg = MIMEText(utf8(custom_msg(msg, person)))
        mailmsg['Subject'] = utf8(custom_msg(subject, person))
        mailmsg['From'] = me
        mailmsg['To'] = person.email

        s = smtplib.SMTP()
        s.connect('localhost', 25)
        s.sendmail(me, toaddr, mailmsg.as_string())
        s.quit()


def sms_reminder(group):
    now = datetime.now()
    midnight_tomorrow = datetime(*[ int(x) for x in
                                    (now + timedelta(hours=24)).strftime('%Y %m %d 23 59').split()])

    # Going to bug people differently based on the time of the day prior to the gameday.
    # i.e start SMS'ing people at noon, harassing by 3pm and full out barrage by 5pm
    nags = [ (20, ("Did I interupt dinner? Well, get to it!",
                   "Should I text you earlier next week?",
                   "Wow. I'm speechless... cause I'm dying.",
                   "It's not movie time, it's predictions time!",
                   "You make me sad.")),
             (18, ("We need it, we need it!",
                   "Waiting until dinner time?",
                   "Coach called.. he's waiting too.",
                   "You've had enough time.")),
             (17, ("Wow! Is it really 5pm.",
                   "Get up and get to your computer.",
                   "You know some people like to see predictions early.",
                   "How did the day get this late?")),
             (15, ("Seriously, people are waiting on you.",
                   "I was being nice.",
                   "Coach called.. he's waiting too.",
                   "Lets think football.",
                   "What could be more important than predictions?")),
             (12, ("Time to read your email.",
                   "Good morning.",
                   "Hello there.",
                   "It's me again.",
                   "Its that time of the week.",
                   "I love football, how about you?")),
             ]
    message = ''
    for H, msgs in nags:
        if now.hour >= H:
            message = random.choice(msgs)
            break

    if message and config.has_section('Twilio'):
        sms = SMS(config.get('Twilio', 'twilio_num'),
                  config.get('Twilio', 'twilio_account'),
                  config.get('Twilio', 'twilio_token'))
        for game in Games.query.filter(and_(Games.gametime < midnight_tomorrow, Games.gametime > now)).all():

            undecided = getundecided(group, game)

            GAME_URL = 'http://%s/%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), group,
                                                   quote(game.hometeam), quote(game.awayteam))

            for person in undecided:
                if config.get('Predictions', 'mode') == 'dev' and \
                   person.name != config.get('Testing', 'testing_name'):
                    continue

                sms.send(person.phonenumber, '%s %s%s/' % (message, GAME_URL, quote(person.name)) )
        del sms


def email_reminder(group):
    """Email the whole group with the predictions on the game.

    Do not call this if all of the predictions are not in yet.
    """
    try:
        now = datetime.now()
        midnight_tomorrow = datetime(*[ int(x) for x in (now + timedelta(hours=24)).strftime('%Y %m %d 23 59').split()])
        for game in Games.query.filter(and_(Games.gametime < midnight_tomorrow, Games.gametime > now)).all():

            undecided = getundecided(group, game)

            GAME_URL = 'http://%s/%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), group,
                                                   quote(game.hometeam), quote(game.awayteam))

            if undecided:
                for pdt in getpredictions(group, game):
                    person = pdt.person
                    if config.get('Predictions', 'mode') == 'dev' and \
                       person.name != config.get('Testing', 'testing_name'):
                        continue

                    # TODO: Use dedent
                    body = """
Thank you for getting your prediction in. You're a true fan.

As a reminder, you put %s(%d) - %s(%d)
If you need to update it, you still can at %s%s/

Or you can review the spread information and/or further opponent data:
http://www.espn.com/college-football/team/fpi?id=194&year=%s

But what I really need from you is to help bug the people who haven't put their predictions in yet.
Please go nag:
  %s

Thank you,
The Gamemaster.
""" % (game.hometeam, pdt.home, game.awayteam, pdt.away,
       GAME_URL, quote(person.name), game.season,
       ', '.join([ p.name for p in undecided ]))

                    me = config.get('Predictions', 'EMAILADDR')
                    toaddr = person.email.split(',')

                    msg = MIMEText(body)
                    msg['Subject'] = 'Thank you for your prediction on the %s vs. %s Game?' % \
                                     (game.hometeam, game.awayteam)
                    msg['From'] = me
                    msg['To'] = person.email

                    s = smtplib.SMTP()
                    s.connect()
                    s.sendmail(me, toaddr, msg.as_string())
                    s.quit()

            for person in undecided:
                if config.get('Predictions', 'mode') == 'dev' and \
                   person.name != config.get('Testing', 'testing_name'):
                    continue

                body = """
Need to get your prediction in for the %s vs. %s game.

Go to %s%s/

Here is a nice summary page for OSU's schedule where you can click on the
opponents and also see spread information:
http://www.espn.com/college-football/team/fpi?id=194&year=%s

And good luck,
The Gamemaster.'
""" % (game.hometeam, game.awayteam, GAME_URL, quote(person.name), game.season)

                # TODO: remove duplicate code
                me = config.get('Predictions', 'EMAILADDR')
                toaddr = person.email.split(',')

                msg = MIMEText(body)
                msg['Subject'] = 'What is your Prediction on the %s vs. %s Game?' % \
                                 (game.hometeam, game.awayteam)
                msg['From'] = me
                msg['To'] = person.email

                s = smtplib.SMTP()
                s.connect()
                s.sendmail(me, toaddr, msg.as_string())
                s.quit()

    except (Exception), e:
        print 'Sorry. Something happened while trying to email: %s' % (str(e))


def email_predictions(group, home_vs_away):
    """Email the whole group with the predictions on the game.

    Do not call this if all of the predictions are not in yet.
    """
    try:
        game = getgamebyversus(home_vs_away, current_season())
        predictions = getpredictions(group, game)

        body = 'Predictions are in!\n\n%s - %s\n' % (game.hometeam, game.awayteam)
        body += '\n'.join([ '%-2d - %-2d by %s' % \
                            (p.home, p.away, p.person.name) for p in predictions ])
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


def sms_gameresults(group, home_vs_away, season, overriding_msg=""):
    try:
        game = game_info(group, home_vs_away, season)

        happy_msg = ["High Five", "Niceeee", "Raise the roof", "Hot Dog!", "Kazaam!", "Great Work",
                     "You're awesome", "How can I be like you?", "Help me next time",
                     "Its like you're psychic", "Ain't life grand?", "W00t!"]
        loser_msg = ["Sorry", "Try Again", "Need a friend to talk to?",
                     "Ah, shucks!", "Darn it!", "Maybe Next time?", "Don't quit on me, though",
                     "Try asking Jon next time", "Ice Cream cheers me up",
                     "Least you have your health", "Try a Popsicle. Will make you happy",
                     "We can't all be winners", "Some days you win, today you lose", "Beep beep"]

        winner = game.people[0]
        coffee_winner = [ p for p in game.people if p.betting ][0]

        if not config.has_section('Twilio'):
            return
        sms = SMS(config.get('Twilio', 'twilio_num'),
                  config.get('Twilio', 'twilio_account'),
                  config.get('Twilio', 'twilio_token'))

        for person in game.people:
            if config.get('Predictions', 'mode') == 'dev' and \
               person.name != config.get('Testing', 'testing_name'):
                continue

            if overriding_msg:
                text = overriding_msg

            # Either one winner
            elif winner == coffee_winner:
                # Coffee better won

                # Is that person you?
                if person == winner:
                    text = 'Collect your coffee! You WIN by being off by %d! %s' % \
                        (person.delta, random.choice(happy_msg))
                else:
                    if person.betting:
                        text = '%s was off by %d, so you owe coffee. You were off by %d. %s' % \
                            (winner.name, winner.delta, person.delta, random.choice(loser_msg))
                    else:
                        text = '%s wins being %d off. You were %d off. %s' % \
                            (winner.name, winner.delta, person.delta, random.choice(loser_msg))
            # Or two winners
            else:
                # Funsie won it

                # Is that person you?
                if person == winner:
                    text = 'Congrats! You win by being off by %d! %s' % \
                        (person.delta, random.choice(happy_msg))
                elif person == coffee_winner:
                    text = '%s wins by being %d off but you WIN coffee being %d off. %s' % \
                        (winner.name, winner.delta, person.delta, random.choice(happy_msg))
                else:
                    if person.betting:
                        text = '%s wins by being %d off and you owe %s coffee who was off %d. You\'re off by %d. %s.' % \
                            (winner.name, winner.delta, coffee_winner.name, coffee_winner.delta,
                             person.delta, random.choice(loser_msg))
                    else:
                        text = '%s wins by being %d off and you were %d off. %s' % \
                            (winner.name, winner.delta, person.delta, random.choice(loser_msg))

            # text += ' http://%s/%s/%s/' % (config.get('Predictions', 'HTTPHOST'),
            #                                group, home_vs_away)
            sms.send(person.phonenumber, text)
        del sms

    except (Exception), e:
        raise e
        #print 'Sorry. You probably are looking for another game?\nPsst: %s' % (str(e))


def print_sms_messages():
    sms = SMS(config.get('Twilio', 'twilio_num'),
              config.get('Twilio', 'twilio_account'),
              config.get('Twilio', 'twilio_token'))
    num2name = dict([ ('+1%s' % p.phonenumber, p.name) for p in Person.query.all() ])
    stat_n, stat_tot = 0, 0.0
    for m in sms.get_messages():
        date_created = m.date_created  # datetime.strptime(m.date_created, '%a, %d %b %Y %H:%M:%S +%f')
        date_sent    = m.date_sent  # datetime.strptime(m.date_sent,    '%a, %d %b %Y %H:%M:%S +%f')
        ts = (date_sent - date_created).total_seconds()
        # Stats
        stat_n   += 1
        stat_tot += ts

        print '%s sent to %s (%s) and completed %fs later:\n  "%s"' % \
            (date_created.strftime('%F %T'), num2name.get(m.to, 'Unknown'), m.to, ts, m.body)

    print '%d messages sent for an average of %fs to complete the message.' % \
        (stat_n, stat_tot / stat_n)


def update_betting_games(group, season):
    """ Ensure that the next game is queued for betting """
    groupplay = getgroup(group, season)
    betting = Betting.query.filter(Betting.group == groupplay).all()
    betting.sort(key=lambda g: g.game.gametime)
    games = [ bet.game for bet in betting ]
    for game in games:
        if game.hscore > -1:
            continue
        if game.hscore == -1:
            # This is the next game up for betting. All is prepped.
            return True
        if game.hscore == -2:
            # Should only hit here if there is no next game and you need to
            # update a future queued game to be next up
            game.hscore = -1
            session.commit()
            return True
    return False


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
        betting = Betting.query.filter(Betting.group == groupplay).all()
        betting.sort(key=lambda g: g.game.gametime)
        games = [ bet.game for bet in betting ]
        for i in range(len(games)):
            game = games[i]
            # first, it is over?
            game.done = (game.hscore > -1)
            # Now help out the templating engine
            game.ahref = '%s_vs_%s' % (game.hometeam, game.awayteam)
            games[i] = game

        myform = web.form.Form(
            web.form.Textbox("Home", value=""),
            web.form.Textbox("Away", value=""),
            web.form.Textbox("Datetime", value=""),
            web.form.Textbox("season", value=current_season()),
            web.form.Password('password', value=""),
        )

        msg = ''
        return render.admin(group, games, myform, msg)

    def POST(self, group):
        i = web.input(auth="bogus", season=current_season())
        try:
            # Could be creating a new season
            groupplay = getgroup(group, i.season)
        except Exception:
            if i.password == config.get('Predictions', 'mpass'):
                newseason(group, i.season)
                groupplay = getgroup(group, i.season)
            else:
                return web.seeother('http://%s/%s/admin' % \
                                    (config.get('Predictions', 'HTTPHOST'), group))

        gametime = dateparse(i.Datetime)
        if not gametime:
            msg = 'Sorry. Could not parse the date of "%s". Try a format of: YYYY-MM-DD HH:MM (%s)' % \
                  (str(i.Datetime), str(gametime))
            betting = Betting.query.filter(Betting.group == groupplay).all()
            betting.sort(key=lambda g: g.game.gametime)
            games = [ bet.game for bet in betting ]
            # games = Games.query.filter(Games.season==i.season).order_by(Games.gametime).all()
            for n in range(len(games)):
                game = games[n]
                # first, it is over?
                game.done = (game.hscore > -1)
                # Now help out the templating engine
                game.ahref = '%s_vs_%s' % (game.hometeam, game.awayteam)
                games[n] = game
            myform = web.form.Form(
                web.form.Textbox("Home", value=i.Home),
                web.form.Textbox("Away", value=i.Away),
                web.form.Textbox("Datetime", value=i.Datetime),
                web.form.Textbox("season", value=current_season()),
                web.form.Password('password', value=""),
            )
            return render.admin(group, games, myform, msg)

        # print 'You want to pit %s against %s on %s via authorization "%s"?' % \
        #     (home, away, gametime, input.auth)
        # FIXME: Should be checking the group's admin password here and
        #        perhaps OR'ing it with the 'mpass'
        if i.password == config.get('Predictions', 'mpass'):
            nextgame = Games(hometeam=i.Home, awayteam=i.Away, gametime=gametime,
                             season=i.season, hscore=-2, ascore=-1)
            betting  = Betting(game=nextgame, group=groupplay)
            session.commit()

            update_betting_games(group, i.season)

            return web.seeother('http://%s/%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'),
                                                            group, quote(i.Home), quote(i.Away)))
        else:
            return 'Sorry, can not help you. That is not the right password.'


class GamesURL:
    """ Main page to show all of the games and season stats """
    def GET(self, group):
        i = web.input(season=current_season())
        selected_season = i.season
        # selected_season = i.season
        # now = datetime.now()
        charts = []
        # We care about three DB things for this page: Games, People, Predictions
        # 1. Games
        groupplay = getgroup(group, i.season)
        betting = Betting.query.filter(Betting.group == groupplay).all()
        betting.sort(key=lambda g: g.game.gametime)
        games = [ bet.game for bet in betting if bet.game.hscore > -2 ]
        # 2. People
        people = getpeople(group, i.season)
        # people = [ m.person for m in Membership.query.filter(Membership.group==groupplay).all() ]
        names = [ p.name for p in people ]
        pindex = dict([ (person.name, idx) for idx, person in enumerate(people) ])
        # some stats initialization
        for name, i in pindex.iteritems():
            person = people[i]
            person.tot_games = 0
            person.tot_delta = 0
            person.game_deltas = {}  # dict of {game_index: delta}
            people[i] = person

        for i in range(len(games)):
            game = game_info(group, '%s_vs_%s' % \
                             (games[i].hometeam, games[i].awayteam), selected_season)

            # Helping out the templating engine
            game.ahref = '%s_vs_%s' % (game.hometeam, game.awayteam)
            if game.hometeam == 'OSU':
                game.opponent = game.awayteam
            else:
                game.opponent = game.hometeam
            games[i] = game

            # # Update stats on completed games
            if not game.done:
                continue

            for i, p in enumerate(game.people):
                person = people[pindex[p.name]]
                person.tot_games += 1
                person.tot_delta += p.delta
                # For graphing purposes
                person.game_deltas[i] = p.delta
                # person
                people[pindex[p.name]] = person

            game.mugshots = [ game.people[0].mugshot ]
            game.winningnames = game.people[0].name

            # Ah, but what about the coffee betters and not the funsies?
            game.coffee_winningnames = ' & '.join([ p.name for p in game.people if p.winningcoffee ])

        people.sort(cmp=lambda a, b: cmp(a.tot_delta, b.tot_delta))

        # Barchart for the season
        barchart_url = "http://chart.apis.google.com/chart" \
                       "?chxl=0:|%s" \
                       "&chxt=y,x" \
                       "&chxr=1,0,%d" \
                       "&chds=0,%d" \
                       "&chbh=a,5" \
                       "&chs=300x225" \
                       "&cht=bhg" \
                       "&chco=A2C180" \
                       "&chd=t:%s" \
                       "&chtt=Total+Points+Off+in+All+Games" \
                       "&chts=EE2525,11.5"

        charts.append(barchart_url % ("|".join([ p.name.replace(' ', '+') for p in reversed(people)]),
                                      people[-1].tot_delta,
                                      people[-1].tot_delta,
                                      ','.join([ ('%d' % p.tot_delta) for p in people ])))

        return render.games(games, people, names, pindex, charts, selected_season, get_seasons())


class PredictionsURL:
    def GET(self, group, home_vs_away):
        try:
            session.commit()
            i = web.input(season=current_season())
            game = game_info(group, home_vs_away, i.season)

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

            return render.predictions(group, game)
        except (Exception), e:
            print 'print_exc():'
            traceback.print_exc(file=sys.stdout)
            return 'Sorry. You probably are looking for another game?\nPsst: %s' % (str(e))

    def POST(self, group, home_vs_away):
        """ Post in-game comments with score updates by our predictors """
        try:
            i = web.input(season=current_season())
            groupplay = getgroup(group, i.season)

            # form data
            homescore = int(i.homescore)
            awayscore = int(i.awayscore)
            comment = i.comment[:100]  # match the varchar length
            password = i.password

            # supplementary info
            session.commit()  # fixes caching?
            person = Person.query.filter_by(password=password).one()
            game = getgamebyversus(home_vs_away, i.season)
            game.done = game.hscore > -1

            # Insert InGameScores commentary by our fellow player
            if not game.done:
                InGameScores(home=homescore, away=awayscore,
                             comment=comment, person=person,
                             game=game, group=groupplay)
                session.commit()

        except (Exception), e:
            return 'DEBUG: Got an error: %s' % (str(e))
            pass
        return web.seeother('http://%s/%s/%s/' % \
                            (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))


class FinalscoreURL:
    def GET(self, group, home_vs_away):
        try:
            i = web.input(season=current_season())
            hometeam, awayteam = home_vs_away.split('_vs_')

            myform = web.form.Form(
                web.form.Textbox(hometeam, value=""),
                web.form.Textbox(awayteam, value=""),
                web.form.Textbox('commentary', value=""),
                web.form.Password('password', value=""),
            )

            return render.finalscore(hometeam, awayteam, myform, msg='')

        except (Exception), e:
            return 'Sorry. You\'re going to have to ssh into the machine to post the score.\nPsst: %s' % (str(e))

    def POST(self, group, home_vs_away):
        try:
            i = web.input(season=current_season())
            hometeam, awayteam = home_vs_away.split('_vs_')
            game = getgamebyversus(home_vs_away, i.season)

            if i.password == config.get('Predictions', 'mpass'):
                game.hscore = int(getattr(i, hometeam))
                game.ascore = int(getattr(i, awayteam))
                game.canceled = game.hscore == 0 and game.ascore == 0
                if game.canceled and i.commentary:
                    game.odds = i.commentary
                session.commit()

                update_betting_games(group, i.season)

                # Send out a SMS message about the winners
                if game.canceled:
                    sms_gameresults(group, home_vs_away, i.season, overriding_msg=i.commentary)
                else:
                    sms_gameresults(group, home_vs_away, i.season)

                return web.seeother('http://%s/%s/%s/' % \
                                    (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))

            else:
                myform = web.form.Form(
                    web.form.Textbox(hometeam, value=getattr(i, hometeam)),
                    web.form.Textbox(awayteam, value=getattr(i, awayteam)),
                    web.form.Textbox('commentary', value=getattr(i, commentary)),
                    web.form.Password('password', value=""),
                )

                return render.finalscore(hometeam, awayteam, myform,
                                         msg='Wrong password. Try again.')

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
            p = [m.person for m in Membership.query.filter(Membership.group == groupplay).all()
                 if m.person.name == name][0]

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
        p = [m.person for m in Membership.query.filter(Membership.group == groupplay).all()
             if m.person.name == name][0]

        # first of all, you can not make predictions when the game is on
        if datetime.now() > game.gametime:
            return web.seeother('http://%s/%s/%s/' % \
                                (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))

        # also, you can not make a prediction once all of the predictions are in.
        undecided = getundecided(group, game)
        if not undecided:
            return web.seeother('http://%s/%s/%s/' % \
                                (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))

        if p.password == i.password or i.password == config.get('Predictions', 'mpass'):
            # Is there already a prediction out there for this?
            q = Predictions.query.filter(and_(Predictions.group == groupplay,
                                              Predictions.game == game,
                                              Predictions.person == p))
            if q.count():
                pp = q.one()
                pp.home = int(getattr(i, hometeam))
                pp.away = int(getattr(i, awayteam))
            else:
                Predictions(home=int(getattr(i, hometeam)),
                            away=int(getattr(i, awayteam)),
                            dt=datetime.now(),
                            person=p,
                            game=game,
                            group=groupplay)

            # all done here
            session.commit()

            # Was this the last prediction? Time to email the group?
            showpredictions = (datetime.now() > game.gametime) or (undecided == [ p ])
            if showpredictions:
                email_predictions(group, home_vs_away)

            return web.seeother('http://%s/%s/%s/' % \
                                (config.get('Predictions', 'HTTPHOST'), group, home_vs_away))
        else:
            myform = web.form.Form(
                web.form.Textbox(hometeam, value=getattr(i, hometeam)),
                web.form.Textbox(awayteam, value=getattr(i, awayteam)),
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
    # Nudge people or send a normal message via SMS or Email
    parser.add_argument('--nudge', '--remind', dest='reminder', action='store_true', default=False,
                        help='Remind people to make a prediction (Pick a method)')
    parser.add_argument('--message', dest='message',
                        help='Send a message to the entire team via SMS or Email (Pick a method)')
    parser.add_argument('--method', dest='method', choices=['sms', 'email'],
                        help='Method to use when nudging contacting people')
    # Summation Actions
    parser.add_argument('--email_predictions', dest='email_predictions',
                        action='store_true', default=False,
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

        newuser = Person(name=name,
                         nickname=nickname,
                         email=email,
                         phonenumber=phonenumber,
                         password=password,
                         betting=betting.lower().startswith('y'))
        member  = Membership(person=newuser, group=getgroup(args.group))
        print 'Added.'
        session.commit()

    elif args.reminder and args.method:
        if args.method == 'email':
            if args.debug:
                print 'Debug: Reminder message via email.'
            email_reminder(args.group)
        else:
            if args.debug:
                print 'Debug: Reminder message via sms.'
            sms_reminder(args.group)

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

    elif args.sms_results and args.home_vs_away:
        home, away = args.home_vs_away
        sms_gameresults(args.group, '%s_vs_%s' % (home, away), current_season())

    elif args.list_sms:
        print_sms_messages()

    # app.run()
