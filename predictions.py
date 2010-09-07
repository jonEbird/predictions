#!/bin/env python

import os, sys, datetime
import web
from web import form
from elixir import *

#-Database-----------------------------------------

metadata.bind = 'sqlite:///predictions.sqlite'
metadata.bind.echo = False

class Game(Entity):
    using_options(tablename='games')
    hometeam    = Field(String(30))
    awayteam    = Field(String(30))
    hscore      = Field(Integer)
    ascore      = Field(Integer)
    gametime    = Field(DateTime)
    predictions = OneToMany('Predictions')

    def __repr__(self):
        return '<Game %s vs. %s on %s>' % (self.hometeam, self.awayteam, self.gametime)

class Predictions(Entity):
    using_options(tablename='predictions')
    home   = Field(Integer)
    away   = Field(Integer)
    dt     = Field(DateTime)
    person = ManyToOne('Person')
    game   = ManyToOne('Game')

    def __repr__(self):
        return '<Prediction by %s for the %s game>' % (self.person.name, self.game)

class Person(Entity):
    using_options(tablename='people')
    name        = Field(String(60))
    nickname    = Field(String(60))
    email       = Field(String(100))
    password    = Field(String(60))
    predictions = OneToMany('Predictions')

    def __repr__(self):
        return '<Person %s>' % self.name

setup_all(True)

#-Web----------------------------------------------

urls = (
    '/', 'GamesURL',
    '/([^/]*)/', 'PredictionsURL',
    '/([^/]*)/([^/]*)/', 'PredictURL',
    '/creategame/(.*)/(.*)/(.*)/(.*)/(.*)/(.*)/(.*)', 'CreategameURL'
)
render = web.template.render('templates/')

class GamesURL:
    def GET(self):
        now = datetime.datetime.now()
        games = Game.query.all()
        for i in range(len(games)):
            game = games[i]
            # first, it is over?
            td = now - game.gametime
            game.done = (td.seconds + td.days * 24 * 3600) > 14400 # 4hours past gametime?
            # Now help out the templating engine
            game.ahref = '%s_vs_%s' % (game.hometeam, game.awayteam)
            games[i] = game
        print render.games(games)

class PredictionsURL:
    def GET(self, game):
        try:
            hometeam, awayteam = game.split('_vs_')
            game = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()
            predictions = game.predictions
            td = datetime.datetime.now() - game.gametime
            if (td.seconds + td.days * 24 * 3600) > 14400: # 4hours past gametime?
                game.done = True
                for i in range(len(predictions)):
                    p = predictions[i]
                    p.delta = abs(game.hscore - p.home) + abs(game.ascore - p.away)
                    predictions[i] = p
                predictions.sort(cmp=lambda a, b: cmp(a.delta,b.delta))
            else:
                game.done = False
            
            # FIXME: Don't really like this query but it's working...
            undecided = Person.query.filter(~Person.name.in_([ p.person.name for p in predictions ])).all()

            # Now, you can only see the predictions when all are in or the game has started.
            game.showpredictions = (datetime.datetime.now() > game.gametime) or not undecided

            print render.predictions(game.predictions, game, undecided)
        except (Exception), e:
            print 'Sorry. You probably are looking for another game?'

class CreategameURL:
    def GET(self, home, away, year, mon, day, hour, min):
        """Example URL would be /creategame/OSU/Marshall/2010/9/2/19/30?auth=bingo"""
        input = web.input(auth="bogus")
        gametime = datetime.datetime(int(year), int(mon), int(day), int(hour), int(min))
        #print 'You want to pit %s against %s on %s via authorization "%s"?' % (home, away, gametime, input.auth)
        if input.auth == "bingo":
            nextgame = Game(hometeam=home, awayteam=away, gametime=gametime)
            session.commit()
            print 'Okay. It\'s %s vs. %s on %s.\n/%s_vs_%s/' % (home, away, gametime, home, away)
        else:
            print 'Sorry, can not help you.'


class PredictURL:
    def GET(self, game, person):
        try:
            #print 'Let\'s see what %s has to say about the %s game.' % (person, game)
            hometeam, awayteam = game.split('_vs_')
            p = Person.query.filter_by(name=person).one()

            myform = form.Form(
                form.Textbox(hometeam, value=""),
                form.Textbox(awayteam, value=""),
                form.Password('password', value=""),
                )

            print render.predict(hometeam, awayteam, p, myform, msg='')
        except (Exception), e:
            print 'Sorry. You probably are looking for another game?\n%s' % (str(e))

    def POST(self, game, person):
        i = web.input(auth="bogus")
        p = Person.query.filter_by(name=person).one()
        hometeam, awayteam = game.split('_vs_')
        g = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()

        # first of all, you can not make predictions when the game is on
        if datetime.datetime.now() > g.gametime:
            return web.seeother('/%s/' % game)

        # also, you can not make a prediction once all of the predictions are in.
        undecided = Person.query.filter(~Person.name.in_([ pdt.person.name for pdt in g.predictions ])).all()
        if not undecided:
            return web.seeother('/%s/' % game)

        if p.password == i.password or i.password == "bingo":
            # Is there already a prediction out there for this?
            q = Predictions.query.filter_by(person=p).filter_by(game=g)
            if q.count():
                pp = q.one()
                pp.home=int(getattr(i,hometeam))
                pp.away=int(getattr(i,awayteam))
            else:
                Predictions(home=int(getattr(i,hometeam)), away=int(getattr(i,awayteam)), dt=datetime.datetime.now(), person=p, game=g)

            # all done here
            session.commit()
            return web.seeother('/%s/' % game)
        else:            
            myform = form.Form(
                form.Textbox(hometeam, value=getattr(i,hometeam)),
                form.Textbox(awayteam, value=getattr(i,awayteam)),
                form.Password('password', value=""),
                )
            
            print render.predict(hometeam, awayteam, p, myform, msg='Wrong password. Try again.')

web.webapi.internalerror = web.debugerror
#app = web.application(urls, globals())

if __name__ == "__main__":
    """ Creating some games via URL. E.g.
    /creategame/OSU/Miami/2010/9/11/15/40?auth=bingo
    """
    if len(sys.argv) > 1 and sys.argv[1] == "dbinit":
        metadata.bind.echo = True
        create_all()
        osu_vs_marshall = Game(hometeam='OSU', hscore=45, ascore=7, awayteam='Marshall', gametime=datetime.datetime(2010, 9, 2, 19, 30))

        jm = Person(name='Jon Miller', nickname='jonEbird', password='bingo')
        Predictions(home=35, away=9, dt=datetime.datetime(2010,9,2,12,0), person=jm, game=osu_vs_marshall)

        ck = Person(name='Cherina Kesuma', nickname='Cherrybum', password='bingo')
        Predictions(home=42, away=7, dt=datetime.datetime(2010,9,2,12,0), person=ck, game=osu_vs_marshall)

        mn = Person(name='Mike Nardone', nickname='Italian Stallion', password='grip')
        Predictions(home=37, away=16, dt=datetime.datetime(2010,9,2,12,0), person=mn, game=osu_vs_marshall)

        tb = Person(name='Todd Bloom', nickname='Sweeney Todd', password='hellyeah')
        Predictions(home=30, away=10, dt=datetime.datetime(2010,9,2,12,0), person=tb, game=osu_vs_marshall)

        ps = Person(name='Patrick Shuff', nickname='Intern', password='michelle')
        Predictions(home=45, away=6, dt=datetime.datetime(2010,9,2,12,0), person=ps, game=osu_vs_marshall)

        jh = Person(name='Joe Huffner', nickname='Hot Stuff', password='sausage')
        Predictions(home=35, away=14, dt=datetime.datetime(2010,9,2,12,0), person=jh, game=osu_vs_marshall)

        th = Person(name='Travis Hines', nickname='The Real Deal', password='bigred')
        Predictions(home=45, away=13, dt=datetime.datetime(2010,9,2,12,0), person=th, game=osu_vs_marshall)

        mk = Person(name='Mark Kelly', nickname='The Hammer', password='thatswhatIsaid')
        Predictions(home=35, away=14, dt=datetime.datetime(2010,9,2,12,0), person=mk, game=osu_vs_marshall)

        lb = Person(name='Lilian Bloom', nickname='Flower Bed', password='ilovetoddscock')
        Predictions(home=35, away=14, dt=datetime.datetime(2010,9,2,12,0), person=lb, game=osu_vs_marshall)

        session.commit()
        sys.exit(0)

    web.run(urls, globals())
    #app.run()
