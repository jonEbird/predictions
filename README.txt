
Game Predictions
--------------------------------------------------

This is intended to be a fun little app to run and share with friends or colleagues
to make predictions on Football games. Grab it and use it to collect predictions on
games and see how you do against your friends.

Checkout how I'm doing with my friends over at http://jonebird.com:8080/

Installation
--------------------------------------------------

- Python. I have tested with versions 2.5 and 2.6.

- sqlite.

- Python modules: elixir

- I use SMS messages to sent to people via google voice, so you need a google voice account.
  See http://sphinxdoc.github.com/pygooglevoice/install.html for installation, but it's basically:
    sudo easy_install simplejson
    sudo easy_install -U pygooglevoice

  You then need to configure your ~/.gvoice
  Obviously change the email and the password.
    
    [auth]
    # Google Account email address (one associated w/ your Voice account)
    email=jonEbird@gmail.com
    
    # Raw password used or login
    password=XXXXXXXXXXXX
    
    [gvoice]
    # Number to place calls from (eg, your google voice number)
    forwardingNumber=
    
    # Default phoneType for your forwardingNumber as defined below
    #  1 - Home
    #  2 - Mobile
    #  3 - Work
    #  7 - Gizmo
    phoneType=2

- Grab this app. 
  git clone git://github.com/jonEbird/predictions.git

Setup
--------------------------------------------------

1. Following the Installation section above.
2. Add users.
     ./predictions.py adduser
   Repeat for each person who's in your group.
3. Create secret password.
   This is a override password which you, as the administrator of the site, can use
   to override the password of the individual people as well as creating games,
   posting results, etc.
     echo "supersecret" > password.txt
3. Configure Google Voice (see Installation section above)
4. Create games.
   You create games via a URL. Here is how you would create a matchup between OSU and Marshall
   on Sept 2nd, 2010 at 7:30pm. Form is /creategame/HomeTeam/AwayTeam/YYYY/MM/DD/HH/MM?auth=<password>
      http://localhost:8080/creategame/OSU/Marshall/2010/9/2/19/30?auth=bingo
      (the password is what you see in step #3 or defaults to "bingo")
5. Start predicting and have fun.
   ./predictions.py

Rules and Scoring
--------------------------------------------------

Scoring is done by calculating how far away your prediction was for each team. 
If you predicted a score of OSU 35 - Marshall 9 and it turned out to be 45 - 7, 
then you'd be off by 12 [ (45-35) + (9-7) ]. Lowest delta wins.

You can put your predictions in as much as you want until the last person gets their prediction is.
Until the last prediction is entered, all you will see is "LOCKED-IN" for your prediction. Basically,
you can not see other people's predictions until the last person submits. After the last prediction
is in, and you can see all of the predictions, you can no longer change your prediction.

History
--------------------------------------------------

I used to write the predictions of my co-workers on my whiteboard each week and it was always fun.
I then landed a position in Architecture and I ended up moving to another floor and it was no longer
easy to track the predictions with the guys. Naturally, the solution was to create this app.
