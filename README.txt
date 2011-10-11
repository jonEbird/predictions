
Game Predictions
--------------------------------------------------

This is intended to be a fun little app to run and share with friends or colleagues
to make predictions on Football games. Grab it and use it to collect predictions on
games and see how you do against your friends.

Checkout how I'm doing with my friends over at http://buckeyepredictions.com/predictions/

Installation
--------------------------------------------------

- Python. I have tested with versions 2.5 and 2.6.

- sqlite.

- Python modules: elixir

- I use SMS messages to sent to people via Twilio.
  If you do not use setup an account, you can still use the app, but it won't be as fun. :-)
  See http://www.twilio.com/docs/quickstart/sms/ for quickstart / installation information, but it's basically:
    sudo pip install twilio # pip-python is the executable on Fedora

- Setup your predictions.config file.
  There is sample.config file to help guide your setup.

- Grab this app.
  git clone git://github.com/jonEbird/predictions.git

- Apache configuration
  I am using Apache for my web serving needs. See the vhosts.conf sample config file.
  Copy it to your Apache config directory (/etc/httpd/conf.d/)
  And finally update it to suit your site specific needs.
  (I.e. Change out all of my buckeyepredictions stuff. This suits as an example)

Setup
--------------------------------------------------

1. Following the Installation section above.
2. Add users.
     ./predictions.py adduser
   Repeat for each person who's in your group.
3. Start the app.
   You can the app in a standalone server or within apache.
   ./predictions/predictions.py
3. Create games.
   Point your browser to your webserver and tack on '/admin' at the end. If you're running a standalone, go to:
   http://localhost:8080/admin
4. Start making predictions
   Again, if you are running in a standalone mode then go to:
   http://localhost:8080/

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
