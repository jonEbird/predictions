from elixir import *
from sqlalchemy import and_, func
from datetime import datetime

#-Database-----------------------------------------

metadata.bind = 'sqlite:///predictions.sqlite'
metadata.bind.echo = False

class Games(Entity):
    using_options(tablename='games')
    hometeam     = Field(String(30))
    awayteam     = Field(String(30))
    hscore       = Field(Integer)
    ascore       = Field(Integer)
    gametime     = Field(DateTime)
    season       = Field(Integer)
    odds         = Field(String)
    predictions  = OneToMany('Predictions')
    ingamescores = OneToMany('InGameScores')
    betting      = OneToMany('Betting')

    def __repr__(self):
        return '<Game %s vs. %s on %s>' % (self.hometeam, self.awayteam, self.gametime)

class Predictions(Entity):
    using_options(tablename='predictions')
    home   = Field(Integer)
    away   = Field(Integer)
    dt     = Field(DateTime)
    person = ManyToOne('Person')
    game   = ManyToOne('Games')
    group  = ManyToOne('GroupPlay')

    def __repr__(self):
        return '<Prediction by %s for the %s game>' % (self.person.name, self.game)

class InGameScores(Entity):
    using_options(tablename='ingamescores')
    home    = Field(Integer)
    away    = Field(Integer)
    comment = Field(String(100))
    person  = ManyToOne('Person')
    game    = ManyToOne('Games')
    group   = ManyToOne('GroupPlay')

    def __repr__(self):
        return '<InGameScores %s(%d) - %s(%d) "%s">' % (self.game.hometeam, self.home, self.game.awayteam, self.away, self.comment)

class GroupPlay(Entity):
    using_options(tablename='groupplay')
    name        = Field(String(100))
    description = Field(String(5000))
    season      = Field(Integer)
    hometeam    = Field(String(50))
    shorturl    = Field(String(100))
    created     = Field(DateTime)
    picture     = Field(String(1000))
    prize       = Field(String(50))
    prize_pic   = Field(String(1000))
    admin       = ManyToOne('Person')

    def __repr__(self):
        return '<GroupPlay %s for the %d season>' % (self.name, self.season)

class Membership(Entity):
    using_options(tablename='membership')
    person = ManyToOne('Person')
    group  = ManyToOne('GroupPlay')

    def __repr__(self):
        return '<Membership of %s with the %s group on the %d season>' % (self.person.name, self.group.name, self.group.season)

class Betting(Entity):
    using_options(tablename='betting')
    game   = ManyToOne('Games')
    group  = ManyToOne('GroupPlay')

    def __repr__(self):
        return '<Betting on the %s game from the %s group>' % (self.game, self.group.name)

class Person(Entity):
    using_options(tablename='people')
    name         = Field(String(60))
    nickname     = Field(String(60))
    email        = Field(String(100))
    phonenumber  = Field(String(15))
    password     = Field(String(60))
    mugshot      = Field(String(50))
    betting      = Field(Boolean)
    predictions  = OneToMany('Predictions')
    ingamescores = OneToMany('InGameScores')
    member       = OneToMany('Membership')

    def __repr__(self):
        return '<Person %s>' % self.name

setup_all(True)

#----------------------------------------------------------------------
# Helper functions

def getgamebyversus(home_vs_away, season):
    try:
        hometeam, awayteam = home_vs_away.split('_vs_')
        return Games.query.filter(and_(Games.hometeam==hometeam, Games.awayteam==awayteam, Games.season==season)).one()
    except (Exception), e:
        return ''

def current_season():
    return session.query(func.max(Games.season).select()).one()[0]

def get_seasons():
    return sorted([ x[0] for x in session.query(func.distinct(Games.season).select()).all() ])

def getgroup(group, season=current_season()):
    """Find the group by the shorturl group name (seen from URLs) and the season"""
    return GroupPlay.query.filter(and_(GroupPlay.season==season, GroupPlay.shorturl==group)).one()

def getpeople(group, season=current_season()):
    return [ member.person for member in Membership.query.filter(Membership.group==getgroup(group, season)).all() ]

def addmember(group, name, season=current_season()):
    """Add person as a member of the group for the given season

    Sometimes people do not participate in one year but re-join the
    following year.

    Args:
      group (str): name of group (e.g. "bucknuts")
      name (str): name of player. (e.g. "Jon Miller")
    """
    group_obj = getgroup(group, season)
    try:
        # FIXME: Terrible that I am not restricting my search to the group
        person = Person.query.filter(Person.name == name).one()
    except:
        return False
    Membership(person=person, group=group_obj)
    session.commit()

def getperson(group, name, season=current_season()):
    person = filter(lambda x: x.name == name, getpeople(group, season))
    if person:
        return person[0]
    else:
        return None

def getpredictions(group, game):
    """Return a list of Prediction objects.
    Args: 'group' is a string and 'game' is a Game object"""
    groupplay = getgroup(group, game.season)
    predictions = Predictions.query.filter(and_(Predictions.group==groupplay, Predictions.game==game)).all()
    return predictions

def getundecided(group, game):
    """Return a list of Person objects.
    Args: 'group' is a string and 'game' is a Game object"""
    predictions = getpredictions(group, game)
    undecided = [ p for p in getpeople(group, game.season) if p.name not in [ pdt.person.name for pdt in predictions ] ]
    return undecided

def newseason(group, season):
    """ Create a new season for the particular group """
    last_season = str(int(season) -1)
    last_group = getgroup(group, season=last_season)
    new_group = GroupPlay(
        name         = last_group.name,
        description  = last_group.description,
        season       = season,  # NEW
        hometeam     = last_group.hometeam,
        shorturl     = last_group.shorturl,
        created      = datetime.now(),
        picture      = last_group.picture,
        prize        = last_group.prize,
        prize_pic    = last_group.prize_pic,
        admin        = last_group.admin,
    )
    # Now we need to add the same people to this season
    for person in getpeople(group, season=last_season):
        Membership(person=person, group=new_group)

    session.commit()

