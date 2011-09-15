#!/bin/bash

cd $(dirname $0)
SRC_DIR=$(pwd)
DST_DIR="/var/www/buckeyepredictions"

if [ ! -d ${DST_DIR} ]; then
    echo "Error: You are not able to push to production: \"${DST_DIR}\" not found to push to. Exiting."
    exit 1
fi

TESTING="n"
if [ "$1" == '-y' ]; then
    TESTING="y"
fi

git ls-files |\
  xargs ls 2>&- |\
  xargs tar -cf - |\
  sudo -u apache tar -C /var/www/buckeyepredictions/predictions/ -xvf -

sudo /etc/init.d/httpd restart

# for file in $(git ls-files); do
#     # Does the file even exist?
#     echo
# done
