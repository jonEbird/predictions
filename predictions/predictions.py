#!/bin/env python

import os, sys, ConfigParser, smtplib, traceback
from datetime import datetime, timedelta
from math import sqrt, pow

abspath = os.path.dirname(__file__)
sys.path.append(abspath)
if abspath: os.chdir(abspath)
import web
from model import *
from utils.ncaa_odds import *
from utils.sms import *
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
    '/', 'GamesURL',
    '/([^/]*)/', 'PredictionsURL',
    '/([^/]*)/final', 'FinalscoreURL',
    '/([^/]*)/([^/]*)/', 'PredictURL',
    '/creategame/(.*)/(.*)/(.*)/(.*)/(.*)/(.*)/(.*)', 'CreategameURL',
    '/admin', 'AdminURL',
    '/mugs', 'Mugs',
)
render = web.template.render('templates/')

def custom_msg(msg, person):
    msg_custom = msg
    msg_custom = msg_custom.replace('%{name}', person.name)
    msg_custom = msg_custom.replace('%{name_url}', quote(person.name))
    msg_custom = msg_custom.replace('%{nickname}', person.nickname)
    msg_custom = msg_custom.replace('%{password}', person.password)
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

def sms_message(msg):
    """Craft a note to be SMS'ed to everyone. Some smart substitutions can occur such as:
       %{name}     = name from DB
       %{name_url} = name from DB urllib.quote'd
       %{nickname} = nickname from DB
    """
    if not config.has_section('Twilio'):
        return
    sms = SMS(config.get('Twilio', 'twilio_num'), config.get('Twilio', 'twilio_account'), config.get('Twilio', 'twilio_token'))
    for person in Person.query.all():
        if config.get('Predictions', 'mode') == 'dev' and person.name != config.get('Testing', 'testing_name'): continue
        sms.send(person.phonenumber, custom_msg(msg, person))
    del sms

def email_message(subject, msg):
    """Craft a note to be emailed to everyone. Some smart substitutions can occur such as:
       %{name}     = name from DB
       %{name_url} = name from DB urllib.quote'd
       %{nickname} = nickname from DB
    """
    for person in Person.query.all():
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

def sms_reminder():
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
        sms = SMS(config.get('Twilio', 'twilio_num'), config.get('Twilio', 'twilio_account'), config.get('Twilio', 'twilio_token'))
        for game in Game.query.filter(and_(Game.gametime < midnight_tomorrow, Game.gametime > now)).all():

            # FIXME: Don't really like this query but it's working...
            undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in game.predictions ])).all()

            GAME_URL = 'http://%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), quote(game.hometeam), quote(game.awayteam))

            for person in undecided:
                if config.get('Predictions', 'mode') == 'dev' and person.name != config.get('Testing', 'testing_name'): continue

                #print 'sms.send(%s, %s)' % (person.phonenumber, '%s %s%s/' % (message, GAME_URL, quote(person.name)) )
                sms.send(person.phonenumber, '%s %s%s/' % (message, GAME_URL, quote(person.name)) )

        del sms


def email_reminder():
    """Email the whole group with the predictions on the game. Do not call this if all of the predictions are not in yet."""
    try:
        now =  datetime.now()
        midnight_tomorrow = datetime(*[ int(x) for x in (now + timedelta(hours=24)).strftime('%Y %m %d 23 59').split()])
        for game in Game.query.filter(and_(Game.gametime < midnight_tomorrow, Game.gametime > now)).all():

            # FIXME: Don't really like this query but it's working...
            undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in game.predictions ])).all()

            GAME_URL = 'http://%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), quote(game.hometeam), quote(game.awayteam))

            if undecided:
                for pdt in game.predictions:
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

Todd suggests this site for spread - http://sportsdirect.usatoday.com/odds/usatoday/ncaaf.aspx
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

def email_predictions(home_vs_away):
    """Email the whole group with the predictions on the game. Do not call this if all of the predictions are not in yet."""
    try:
        hometeam, awayteam = home_vs_away.split('_vs_')
        game = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()
        predictions = game.predictions

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

def sms_gameresults(home_vs_away):
    try:
        hometeam, awayteam = home_vs_away.split('_vs_')
        game = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()
        game.done = (game.hscore != -1)

        predictions = game.predictions
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
        sms = SMS(config.get('Twilio', 'twilio_num'), config.get('Twilio', 'twilio_account'), config.get('Twilio', 'twilio_token'))

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
            text += ' http://%s/%s/' % (config.get('Predictions', 'HTTPHOST'), home_vs_away)

            sms.send(pdt.person.phonenumber, text)

        del sms

    except (Exception), e:
        raise e
        #print 'Sorry. You probably are looking for another game?\nPsst: %s' % (str(e))

class Mugs:
    def GET(self):
        people = Person.query.all()
        return render.mugs(people)

class AdminURL:
    def GET(self):
        games = Game.query.order_by(Game.gametime).all()
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
            web.form.Password('password', value=""),
            )

        msg = ''
        return render.admin(games, myform, msg)

    def POST(self):
        i = web.input(auth="bogus")
        gametime = dateparse(i.Datetime)
        if not gametime:
            msg = 'Sorry. Could not parse the date of "%s". Try a format of: YYYY-MM-DD HH:MM (%s)' % (str(i.Datetime), str(gametime))
            games = Game.query.order_by(Game.gametime).all()
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
                web.form.Password('password', value=""),
                )
            return render.admin(games, myform, msg)

        #print 'You want to pit %s against %s on %s via authorization "%s"?' % (home, away, gametime, input.auth)
        if i.password == config.get('Predictions', 'mpass'):
            nextgame = Game(hometeam=i.Home, awayteam=i.Away, gametime=gametime, hscore=-1, ascore=-1)
            session.commit()
            return web.seeother('http://%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), quote(i.Home), quote(i.Away)))
        else:
            return 'Sorry, can not help you. That is not the right password.'


class GamesURL:
    def GET(self):
        now = datetime.now()
        games = Game.query.order_by(Game.gametime).all()
        charts = []
        people = Person.query.all()
        pindex = dict([ (person.name, i) for i, person in enumerate(people) ])
        # some stats initialization
        for name, i in pindex.iteritems():
            person = people[i]
            person.tot_games = 0
            person.tot_delta = 0
            people[i] = person

        for i in range(len(games)):
            game = games[i]
            # first, it is over?
            td = now - game.gametime
            #game.done = (td.seconds + td.days * 24 * 3600) > 14400 # 4hours past gametime?
            game.done = (game.hscore != -1)
            # Now help out the templating engine
            game.ahref = '%s_vs_%s' % (game.hometeam, game.awayteam)
            games[i] = game

            # Update stats on completed games
            if not game.done:
                continue
            predictions = game.predictions
            for pdt in predictions:
                try:
                    delta = abs(game.hscore - pdt.home) + abs(game.ascore - pdt.away)
                    pdt.delta = delta
                    name = pdt.person.name
                    person = people[pindex[name]]
                    person.tot_games += 1
                    person.tot_delta += delta
                    people[pindex[name]] = person
                except (TypeError), e:
                    continue

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

            undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in game.predictions ])).all()
            for dummy in undecided:
                person = people[pindex[dummy.name]]
                person.tot_games += 1
                person.tot_delta += game.penalty
                people[pindex[dummy.name]] = person

        people.sort(cmp=lambda a, b: cmp(a.tot_delta, b.tot_delta))
        #charts.append("""http://chart.apis.google.com/chart?chxl=0:|%s&chxr=0,0,%d&chds=0,%d&chxt=y,x&chbh=a,5&chs=300x225&cht=bhg&chco=A2C180&chd=t:%s&chtt=Total+Points+Off+in+All+Games&chts=EE2525,11.5""" % ( "|".join([ p.name.replace(' ', '+') for p in people.__reversed__()]), people[-1].tot_delta, people[-1].tot_delta, ','.join([ ('%d' % p.tot_delta) for p in people ]) ))

        charts.append("""http://chart.apis.google.com/chart?chxl=0:|%s&chxt=y,x&chxr=1,0,%d&chds=0,%d&chbh=a,5&chs=300x225&cht=bhg&chco=A2C180&chd=t:%s&chtt=Total+Points+Off+in+All+Games&chts=EE2525,11.5""" % ("|".join([ p.name.replace(' ', '+') for p in people.__reversed__()]), people[-1].tot_delta, people[-1].tot_delta, ','.join([ ('%d' % p.tot_delta) for p in people ])) )

        return render.games(games, people, charts)

class PredictionsURL:
    def GET(self, home_vs_away):
        try:
            hometeam, awayteam = home_vs_away.split('_vs_')
            session.commit() # fixes caching?
            game = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()
            predictions = game.predictions

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
            undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in game.predictions ])).all()

            # Now, you can only see the predictions when all are in or the game has started.
            game.showpredictions = (datetime.now() > game.gametime) or not undecided

            return render.predictions(game.predictions, game, undecided)
        except (Exception), e:
            print 'print_exc():'
            traceback.print_exc(file=sys.stdout)
            return 'Sorry. You probably are looking for another game?\nPsst: %s' % (str(e))

    def POST(self, home_vs_away):
        try:
            i = web.input()
            hometeam, awayteam = home_vs_away.split('_vs_')

            # form data
            homescore = int(i.homescore)
            awayscore = int(i.awayscore)
            comment = i.comment[:100] # match the varchar length
            password = i.password

            # supplementary info
            session.commit() # fixes caching?
            person = Person.query.filter_by(password=password).one()
            game = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()

            # Insert InGameScores commentary by our fellow player
            InGameScores(home=homescore, away=awayscore, comment=comment, person=person, game=game)
            session.commit()

        except (Exception), e:
            return 'DEBUG: Got an error: %s' % (str(e))
            pass
        return web.seeother('http://%s/%s/' % (config.get('Predictions', 'HTTPHOST'), home_vs_away))

class CreategameURL:
    def GET(self, home, away, year, mon, day, hour, min):
        """Example URL would be /creategame/OSU/Marshall/2010/9/2/19/30?auth=<password>"""
        i = web.input(auth="bogus")
        gametime = datetime(int(year), int(mon), int(day), int(hour), int(min))
        #print 'You want to pit %s against %s on %s via authorization "%s"?' % (home, away, gametime, i.auth)
        if i.auth == config.get('Predictions', 'mpass'):
            nextgame = Game(hometeam=home, awayteam=away, gametime=gametime, hscore=-1, ascore=-1)
            session.commit()
            return web.seeother('http://%s/%s_vs_%s/' % (config.get('Predictions', 'HTTPHOST'), home, away))
        else:
            return 'Sorry, can not help you.'

class FinalscoreURL:
    def GET(self, game):
        try:
            hometeam, awayteam = game.split('_vs_')
            g = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()

            myform = web.form.Form(
                web.form.Textbox(hometeam, value=""),
                web.form.Textbox(awayteam, value=""),
                web.form.Password('password', value=""),
                )

            return render.finalscore(hometeam, awayteam, myform, msg='')

        except (Exception), e:
            return 'Sorry. You\'re going to have to ssh into the machine to post the score.\nPsst: %s' % (str(e))

    def POST(self, game):
        try:
            i = web.input()
            hometeam, awayteam = game.split('_vs_')
            g = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()

            if i.password == config.get('Predictions', 'mpass'):
                g.hscore = int(getattr(i,hometeam))
                g.ascore = int(getattr(i,awayteam))
                session.commit()

                # Send out a SMS message about the winners
                sms_gameresults(game)

                return web.seeother('http://%s/%s/' % (config.get('Predictions', 'HTTPHOST'), game))

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
    def GET(self, game, person):
        try:
            #print 'Let\'s see what %s has to say about the %s game.' % (person, game)
            hometeam, awayteam = game.split('_vs_')
            game = getgamebyversus(game)
            p = Person.query.filter_by(name=person).one()

            myform = web.form.Form(
                web.form.Textbox(hometeam, value=""),
                web.form.Textbox(awayteam, value=""),
                web.form.Password('password', value=""),
                )

            return render.predict(game, p, myform, msg='')
        except (Exception), e:
            return 'Sorry. You probably are looking for another game?\n%s' % (str(e))

    def POST(self, home_vs_away, person):
        i = web.input(auth="bogus")
        p = Person.query.filter_by(name=person).one()
        hometeam, awayteam = home_vs_away.split('_vs_')
        game = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()

        # first of all, you can not make predictions when the game is on
        if datetime.now() > game.gametime:
            return web.seeother('http://%s/%s/' % (config.get('Predictions', 'HTTPHOST'), home_vs_away))

        # also, you can not make a prediction once all of the predictions are in.
        undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in game.predictions ])).all()
        if not undecided:
            return web.seeother('http://%s/%s/' % (config.get('Predictions', 'HTTPHOST'), home_vs_away))

        if p.password == i.password or i.password == config.get('Predictions', 'mpass'):
            # Is there already a prediction out there for this?
            q = Predictions.query.filter_by(person=p).filter_by(game=game)
            if q.count():
                pp = q.one()
                pp.home=int(getattr(i,hometeam))
                pp.away=int(getattr(i,awayteam))
            else:
                Predictions(home=int(getattr(i,hometeam)), away=int(getattr(i,awayteam)), dt=datetime.now(), person=p, game=game)

            # all done here
            session.commit()

            # Last prediction? Time to email the group?
            undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in game.predictions ])).all() # FIXME (ugly)
            showpredictions = (datetime.now() > game.gametime) or not undecided
            if showpredictions:
                email_predictions(home_vs_away)

            return web.seeother('http://%s/%s/' % (config.get('Predictions', 'HTTPHOST'), home_vs_away))
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

    if (len(sys.argv) > 1 and sys.argv[1] in ['adduser', 'newuser', 'useradd']):
        print "Adding a new user. I will prompt you for the necessary intel."
        name        = raw_input("  Full Name: ")
        nickname    = raw_input("  Nickame: ")
        email       = raw_input("  Email: ")
        phonenumber = raw_input("  Phone#: ")
        password    = raw_input("  Password: ")

        newuser = Person(name=name, nickname=nickname, email=email, phonenumber=phonenumber, password=password)
        print 'Added.'
        session.commit()
        sys.exit(0)

    elif (len(sys.argv) > 1 and sys.argv[1] in ['remind', 'nudge']):
        email_reminder()
        sys.exit(0)

    elif (len(sys.argv) > 1 and sys.argv[1] in ['sms_bug']):
        sms_reminder()
        sys.exit(0)

    elif (len(sys.argv) == 3 and sys.argv[1] in ['summary']):
        email_predictions(sys.argv[2])
        sys.exit(0)

    elif (len(sys.argv) == 3 and sys.argv[1] in ['sms_all', 'txt_all']):
        sms_message(sys.argv[2])
        sys.exit(0)

    elif (len(sys.argv) == 3 and sys.argv[1] in ['email_all']):
        body = sys.stdin.read()
        email_message(sys.argv[2], body)
        sys.exit(0)

    elif (len(sys.argv) == 3 and sys.argv[1] in ['sms_final', 'sms_gameresults']):
        home_vs_away = sys.argv[2]
        sms_gameresults(home_vs_away)
        sys.exit(0)

    #web.run(urls, globals())
    app.run()
