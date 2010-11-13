#!/bin/env python

import os, sys
from datetime import datetime, timedelta
from math import sqrt, pow
import web
from model import *
from utils.ncaa_odds import *
from utils.sms import *
import smtplib
from urllib import quote
from email.mime.text import MIMEText

# Defaults
mpass = 'bingo'
mode  = 'dev'
EMAILADDR = 'jon@jonebird.com'
HTTPHOST  = 'jonebird.com:8080'

#-Web----------------------------------------------

urls = (
    '/', 'GamesURL',
    '/([^/]*)/', 'PredictionsURL',
    '/([^/]*)/final', 'FinalscoreURL',
    '/([^/]*)/([^/]*)/', 'PredictURL',
    '/creategame/(.*)/(.*)/(.*)/(.*)/(.*)/(.*)/(.*)', 'CreategameURL',
    '/admin', 'AdminURL',
)
render = web.template.render('templates/')

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

    if message:
        sms = SMS()
        for game in Game.query.filter(and_(Game.gametime < midnight_tomorrow, Game.gametime > now)).all():   
    
            # FIXME: Don't really like this query but it's working...
            undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in game.predictions ])).all()
            
            GAME_URL = 'http://%s/%s_vs_%s/' % (HTTPHOST, quote(game.hometeam), quote(game.awayteam))

            for person in undecided:
                if mode == 'dev' and person.name != "Jon Miller": continue

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
            
            GAME_URL = 'http://%s/%s_vs_%s/' % (HTTPHOST, quote(game.hometeam), quote(game.awayteam))

            if undecided:
                for pdt in game.predictions:
                    person = pdt.person
                    if mode == 'dev' and person.name != "Jon Miller": continue
                    
                    body =  'Thank you for getting your prediction in. You\'re a true fan.\n\n'
                    body += 'As a reminder, you put %s(%d) - %s(%d)\n' % (game.hometeam, pdt.home, game.awayteam, pdt.away)
                    body += 'If you need to update it, you still can at %s%s/\n\n' % (GAME_URL, quote(person.name))
                    body += 'But what I really need from you is to help bug the people who haven\'t put their predictions in yet.\n'
                    body += 'Please go nag:\n  %s\n\n' % (', '.join([ p.name for p in undecided ]))
                    body += 'Thank you,\nThe Gamemaster.'
    
                    me = EMAILADDR
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
                if mode == 'dev' and person.name != "Jon Miller": continue
    
                body =  'Need to get your prediction in for the %s vs. %s game.\n\n' % (game.hometeam, game.awayteam)
                body += 'Go to %s%s/\n\n' % (GAME_URL, quote(person.name))
                body += 'Todd suggests this site for spread - http://sportsdirect.usatoday.com/odds/usatoday/ncaaf.aspx\n'
                body += 'But you will already find the odds included on the prediction page for your convenience.\n\n'
                body += 'And good luck,\nThe Gamemaster.'
    
                me = EMAILADDR
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
        msg['From'] = EMAILADDR
        msg['To']   = EMAILADDR
        if mode == 'dev':
            bcc = ['jonEbird@gmail.com']
        else:
            bcc = (','.join([ pdt.person.email for pdt in predictions ])).split(',')

        s = smtplib.SMTP()
        s.connect()
        s.sendmail(EMAILADDR, bcc, msg.as_string())
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
            predictions[i] = p
        predictions.sort(cmp=lambda a, b: cmp(a.delta,b.delta))
        winner = predictions[0]
        ties = [ pdt.person.name for pdt in predictions if pdt.delta == winner.delta ]

        sms = SMS()

        for pdt in predictions:
            person = pdt.person
            if mode == 'dev' and person.name != "Jon Miller":
                continue

            if len(ties) > 1:
                if person.name in ties:
                    text = 'Lucky SOB. You and %s win coffee by tying at being %d off!' % (' & '.join([ o for o in ties if o != person.name]), winner.delta)
                else:
                    text = 'A tie! %s win coffee being %d off. You were %d off, loser.' % (' & '.join(ties), winner.delta, pdt.delta)
            else:
                if person == winner.person:
                    text = 'Lucky SOB, you win coffee by being off by %d!' % (pdt.delta)
                else:
                    text = '%s wins coffee being %d off. You were %d off, loser.' % (winner.person.name, winner.delta, pdt.delta)
            text += ' http://%s/%s/' % (HTTPHOST, home_vs_away)

            sms.send(pdt.person.phonenumber, text)

        del sms

    except (Exception), e:
        raise e
        #print 'Sorry. You probably are looking for another game?\nPsst: %s' % (str(e))
    
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
        print render.admin(games)

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

        print render.games(games, people, charts)

class PredictionsURL:
    def GET(self, home_vs_away):
        try:
            hometeam, awayteam = home_vs_away.split('_vs_')
            game = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()
            predictions = game.predictions

            # Do I need to fetch the odds on the game?
            #  Shouldn't try to fetch before at least 4 days till game.
            now = datetime.now()
            if (game.gametime - now) < timedelta(days=4) and not game.odds:
                odds_html = get_odds(home_vs_away)
                game.odds = odds_html
                session.commit()

            # Need to know if the game has started or not.
            game.started = now > game.gametime

            #td = datetime.now() - game.gametime
            #if (td.seconds + td.days * 24 * 3600) > 14400: # 4hours past gametime?
            if (game.hscore != -1):
                game.done = True
                for i in range(len(predictions)):
                    p = predictions[i]
                    p.delta = abs(game.hscore - p.home) + abs(game.ascore - p.away)
                    predictions[i] = p
                predictions.sort(cmp=lambda a, b: cmp(a.delta,b.delta))
                # Statistics
                game.mean    = sum([ pdt.delta for pdt in predictions ]) / len(predictions)
                game.stddev  = sqrt(sum([ pow(pdt.delta - game.mean, 2) for pdt in predictions ]) / len(predictions))
                game.penalty = int(game.mean + (game.stddev / 2))
            else:
                game.done = False
            
            # FIXME: Don't really like this query but it's working...
            undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in game.predictions ])).all()

            # Now, you can only see the predictions when all are in or the game has started.
            game.showpredictions = (datetime.now() > game.gametime) or not undecided

            print render.predictions(game.predictions, game, undecided)
        except (Exception), e:
            print 'Sorry. You probably are looking for another game?\nPsst: %s' % (str(e))

class CreategameURL:
    def GET(self, home, away, year, mon, day, hour, min):
        """Example URL would be /creategame/OSU/Marshall/2010/9/2/19/30?auth=<password>"""
        input = web.input(auth="bogus")
        gametime = datetime(int(year), int(mon), int(day), int(hour), int(min))
        #print 'You want to pit %s against %s on %s via authorization "%s"?' % (home, away, gametime, input.auth)
        if input.auth == mpass:
            nextgame = Game(hometeam=home, awayteam=away, gametime=gametime, hscore=-1, ascore=-1)
            session.commit()
            print 'Okay. It\'s %s vs. %s on %s.\n/%s_vs_%s/' % (home, away, gametime, home, away)
        else:
            print 'Sorry, can not help you.'
        return web.seeother('/%s_vs_%s/' % (home, away))

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

            print render.finalscore(hometeam, awayteam, myform, msg='')

        except (Exception), e:
            print 'Sorry. You\'re going to have to ssh into the machine to post the score.\nPsst: %s' % (str(e))

    def POST(self, game):
        try:
            i = web.input()
            hometeam, awayteam = game.split('_vs_')
            g = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()
            
            if i.password == mpass:
                g.hscore = int(getattr(i,hometeam))
                g.ascore = int(getattr(i,awayteam))
                session.commit()

                # Send out a SMS message about the winners
                sms_gameresults(game)

                return web.seeother('/%s/' % game)

            else:
                myform = web.form.Form(
                    web.form.Textbox(hometeam, value=getattr(i,hometeam)),
                    web.form.Textbox(awayteam, value=getattr(i,awayteam)),
                    web.form.Password('password', value=""),
                    )
            
                print render.predict(g, myform, msg='Wrong password. Try again.')
                return
        
        except (Exception), e:
            print 'Seriously, you\'re going to have to ssh into the machine to post the score.\nPsst: %s' % (str(e))

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

            print render.predict(game, p, myform, msg='')
        except (Exception), e:
            print 'Sorry. You probably are looking for another game?\n%s' % (str(e))

    def POST(self, home_vs_away, person):
        i = web.input(auth="bogus")
        p = Person.query.filter_by(name=person).one()
        hometeam, awayteam = home_vs_away.split('_vs_')
        game = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()

        # first of all, you can not make predictions when the game is on
        if datetime.now() > game.gametime:
            return web.seeother('/%s/' % home_vs_away)

        # also, you can not make a prediction once all of the predictions are in.
        undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in game.predictions ])).all()
        if not undecided:
            return web.seeother('/%s/' % home_vs_away)

        if p.password == i.password or i.password == mpass:
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

            return web.seeother('/%s/' % home_vs_away)
        else:            
            myform = web.form.Form(
                web.form.Textbox(hometeam, value=getattr(i,hometeam)),
                web.form.Textbox(awayteam, value=getattr(i,awayteam)),
                web.form.Password('password', value=""),
                )
            
            print render.predict(game, p, myform, msg='Wrong password. Try again.')

web.webapi.internalerror = web.debugerror
#app = web.application(urls, globals())

if __name__ == "__main__":

    try:
        mpass = open('password.txt', 'r').readline().strip()
    except (IOError), e:
        print """WARNING: Guess we're sticking with the default password of 'bingo'. Please add a one-liner "password.txt" file."""

    try:
        mode = open('mode.txt', 'r').readline().strip()
    except (IOError), e:
        print """WARNING: Guess we'll run in "dev" mode. Please add a one-liner "mode.txt" file."""
    if mode == 'dev': HTTPHOST = 'localhost:8080'

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

    web.run(urls, globals())
    #app.run()
