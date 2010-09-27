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
    phonenumber = Field(String(15))
    password    = Field(String(60))
    predictions = OneToMany('Predictions')

    def __repr__(self):
        return '<Person %s>' % self.name

setup_all(True)
