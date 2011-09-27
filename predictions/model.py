from elixir import *
from sqlalchemy import and_

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
    odds        = Field(String)
    predictions = OneToMany('Predictions')
    ingamescores = OneToMany('InGameScores')

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

class InGameScores(Entity):
    using_options(tablename='ingamescores')
    home    = Field(Integer)
    away    = Field(Integer)
    comment = Field(String(100))
    person  = ManyToOne('Person')
    game    = ManyToOne('Game')

    def __repr__(self):
        return '<InGameScores %s(%d) - %s(%d) "%s">' % (self.game.hometeam, self.home, self.game.awayteam, self.away, self.comment)

class Person(Entity):
    using_options(tablename='people')
    name        = Field(String(60))
    nickname    = Field(String(60))
    email       = Field(String(100))
    phonenumber = Field(String(15))
    password    = Field(String(60))
    mugshot     = Field(String(50))
    predictions = OneToMany('Predictions')
    predictions = OneToMany('InGameScores')

    def __repr__(self):
        return '<Person %s>' % self.name

setup_all(True)

#----------------------------------------------------------------------
# Helper functions

def getgamebyversus(home_vs_away):
    try:
        hometeam, awayteam = home_vs_away.split('_vs_')
        game = Game.query.filter_by(hometeam=hometeam).filter_by(awayteam=awayteam).one()
        return game
    except (Exception), e:
        return ''
