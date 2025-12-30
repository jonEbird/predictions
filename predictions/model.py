from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    and_,
    create_engine,
    func,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

# -Database-----------------------------------------

Base = declarative_base()


class Games(Base):
    __tablename__ = "games"
    id = Column(Integer, primary_key=True)
    hometeam = Column(String(30))
    awayteam = Column(String(30))
    hscore = Column(Integer)
    ascore = Column(Integer)
    gametime = Column(DateTime)
    season = Column(Integer)
    odds = Column(String)
    # predictions = OneToMany("Predictions")
    predictions = relationship("Predictions", back_populates="game")

    # ingamescores = OneToMany("InGameScores")
    ingamescores = relationship("InGameScores", back_populates="game")

    # betting = OneToMany("Betting")
    betting = relationship("Betting", back_populates="game")

    def __repr__(self):
        return "<Game %s vs. %s on %s>" % (self.hometeam, self.awayteam, self.gametime)


class Predictions(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True)
    home = Column(Integer)
    away = Column(Integer)
    dt = Column(DateTime)

    # person = ManyToOne("Person")
    person_id = Column(Integer, ForeignKey("people.id"))
    person = relationship("Person", back_populates="predictions")

    # game = ManyToOne("Games")
    game = relationship("Games", back_populates="predictions")
    game_id = Column(Integer, ForeignKey("games.id"))

    # group = ManyToOne("GroupPlay")
    group_id = Column(Integer, ForeignKey("groupplay.id"))
    group = relationship("GroupPlay")

    def __repr__(self):
        return "<Prediction by %s for the %s game>" % (self.person.name, self.game)


class InGameScores(Base):
    __tablename__ = "ingamescores"
    id = Column(Integer, primary_key=True)
    home = Column(Integer)
    away = Column(Integer)
    comment = Column(String(100))
    person_id = Column(Integer, ForeignKey("people.id"))
    person = relationship("Person", back_populates="ingamescores")
    # game = ManyToOne("Games")
    game_id = Column(Integer, ForeignKey("games.id"))
    game = relationship("Games", back_populates="ingamescores")
    # group = ManyToOne("GroupPlay")
    group_id = Column(Integer, ForeignKey("groupplay.id"))
    group = relationship("GroupPlay")

    def __repr__(self):
        return '<InGameScores %s(%d) - %s(%d) "%s">' % (
            self.game.hometeam,
            self.home,
            self.game.awayteam,
            self.away,
            self.comment,
        )


class GroupPlay(Base):
    __tablename__ = "groupplay"
    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    description = Column(String(5000))
    season = Column(Integer)
    hometeam = Column(String(50))
    shorturl = Column(String(100))
    created = Column(DateTime)
    picture = Column(String(1000))
    prize = Column(String(50))
    prize_pic = Column(String(1000))
    admin_id = Column(Integer, ForeignKey("people.id"))
    admin = relationship("Person")

    def __repr__(self):
        return "<GroupPlay %s for the %d season>" % (self.name, self.season)


class Membership(Base):
    __tablename__ = "membership"
    id = Column(Integer, primary_key=True)
    person_id = Column(Integer, ForeignKey("people.id"))
    person = relationship("Person", back_populates="member")
    # group = ManyToOne("GroupPlay")
    group_id = Column(Integer, ForeignKey("groupplay.id"))
    group = relationship("GroupPlay")

    def __repr__(self):
        return "<Membership of %s with the %s group on the %d season>" % (
            self.person.name,
            self.group.name,
            self.group.season,
        )


class Betting(Base):
    __tablename__ = "betting"
    id = Column(Integer, primary_key=True)
    # game = ManyToOne("Games")
    game_id = Column(Integer, ForeignKey("games.id"))
    game = relationship("Games", back_populates="betting")
    # group = ManyToOne("GroupPlay")
    group_id = Column(Integer, ForeignKey("groupplay.id"))
    group = relationship("GroupPlay")

    def __repr__(self):
        return "<Betting on the %s game from the %s group>" % (
            self.game,
            self.group.name,
        )


class Person(Base):
    __tablename__ = "people"
    id = Column(Integer, primary_key=True)
    name = Column(String(60))
    nickname = Column(String(60))
    email = Column(String(100))
    phonenumber = Column(String(15))
    password = Column(String(60))
    mugshot = Column(String(50))
    betting = Column(Boolean)
    # predictions = OneToMany("Predictions")
    predictions = relationship("Predictions", back_populates="person")
    # ingamescores = OneToMany("InGameScores")
    ingamescores = relationship("InGameScores", back_populates="person")
    # member = OneToMany("Membership")
    member = relationship("Membership", back_populates="person")

    def __repr__(self):
        return "<Person %s>" % self.name


engine = create_engine("sqlite:///predictions.sqlite", echo=False)
Session = sessionmaker(bind=engine)
session = Session()
Base.metadata.create_all(engine)

# Running notes
# Adding https://docs.sqlalchemy.org/en/14/orm/tutorial.html#adding-and-updating-objects
#  Can add multiple at once via session.add_all(...)
# Persist via session.commit()
# Relationships https://docs.sqlalchemy.org/en/14/orm/tutorial.html#building-a-relationship
# https://docs.sqlalchemy.org/en/14/orm/basic_relationships.html#relationship-patterns

# ----------------------------------------------------------------------
# Helper functions


def getgamebyversus(home_vs_away, season):
    if "_vs_" not in home_vs_away:
        raise ValueError(f"Can not split '{home_vs_away}' with '_vs_'")
    hometeam, awayteam = home_vs_away.split("_vs_")
    return (
        session.query(Games)
        .filter(
            and_(
                Games.hometeam == hometeam,
                Games.awayteam == awayteam,
                Games.season == season,
            )
        )
        .one()
    )


def current_season():
    # return session.query(func.max(Games.season).select()).one()[0]
    return session.query(func.max(Games.season).select().subquery()).one()[0]


def get_seasons():
    return sorted(session.query(func.distinct(Games.season).select().subquery()).all())


def getgroup(group, season=None):
    """Find the group by the shorturl group name (seen from URLs) and the season"""
    if season is None:
        season = current_season()
    return (
        session.query(GroupPlay)
        .filter(and_(GroupPlay.season == season, GroupPlay.shorturl == group))
        .one()
    )


def getpeople(group, season=None):
    if season is None:
        season = current_season()
    members = (
        session.query(Membership)
        .filter(Membership.group == getgroup(group, season))
        .all()
    )
    return [member.person for member in members]


def addmember(group, name, season=None):
    """Add person as a member of the group for the given season

    Sometimes people do not participate in one year but re-join the
    following year.

    Args:
      group (str): name of group (e.g. "bucknuts")
      name (str): name of player. (e.g. "Jon Miller")
    """
    if season is None:
        season = current_season()
    group_obj = getgroup(group, season)
    try:
        person = session.query(Person).filter(Person.name == name).one()
    except:
        return False
    Membership(person=person, group=group_obj)
    session.commit()


def remove_member(group, name, season=None):
    """Remove a user from a particular season

    Args:
      group (str): name of the group. E.g. "bucknuts"
      name (str): name of the user. E.g. "Joe Blow"
      season (int): season year
    Returns:
      bool: success in removing the user from this season
    """
    if season is None:
        season = current_season()
    group_obj = getgroup(group, season)
    try:
        person = session.query(Person).filter(Person.name == name).one()
    except:
        return False
    # First remove predictions from this season
    season_picks = (
        session.query(Predictions)
        .filter(and_(Predictions.group == group_obj, Predictions.person == person))
        .all()
    )
    list(map(session.delete, season_picks))
    # Then remove membership from this season all together
    club_pass = (
        session.query(Membership)
        .filter(and_(Membership.person == person, Membership.group == group_obj))
        .one()
    )
    session.delete(club_pass)
    session.commit()


def getperson(group, name, season=None):
    if season is None:
        season = current_season()
    person = [x for x in getpeople(group, season) if x.name == name]
    if person:
        return person[0]
    else:
        return None


def getpredictions(group, game):
    """Return a list of Prediction objects.
    Args: 'group' is a string and 'game' is a Game object"""
    groupplay = getgroup(group, game.season)
    predictions = (
        session.query(Predictions)
        .filter(and_(Predictions.group == groupplay, Predictions.game == game))
        .all()
    )
    return predictions


def getundecided(group, game):
    """Return a list of Person objects.

    Args:
      group (str)
      game (Game)
    """
    predictions = getpredictions(group, game)
    already_predicted = [pdt.person.name for pdt in predictions]
    undecided = [
        p for p in getpeople(group, game.season) if p.name not in already_predicted
    ]
    return undecided


def newseason(group, season):
    """Create a new season for the particular group"""
    last_season = str(int(season) - 1)
    last_group = getgroup(group, season=last_season)
    new_group = GroupPlay(
        name=last_group.name,
        description=last_group.description,
        season=season,  # NEW
        hometeam=last_group.hometeam,
        shorturl=last_group.shorturl,
        created=datetime.now(),
        picture=last_group.picture,
        prize=last_group.prize,
        prize_pic=last_group.prize_pic,
        admin=last_group.admin,
    )
    # Now we need to add the same people to this season
    for person in getpeople(group, season=last_season):
        Membership(person=person, group=new_group)

    session.commit()
