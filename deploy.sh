#!/bin/bash

set -e

cd "$(dirname "$0")"
SRC_DIR=$(pwd)
DST_DIR="/var/www/buckeyepredictions"

usage() {
    cat <<EOF
Usage: $(basename -- $0) [-n] [pulldb] [prod]
       If "prod" not specified, will try to deploy locally.
EOF
}

TESTING="no"
MODE="dev"
[ "$1" == '-n' ] && { shift; TESTING="yes"; }

if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    usage
    exit 0
fi

# Other ways to use this script
# 1. Pull production DB
if [ "$1" == "pulldb" ]; then
    echo "Pulling DB from prod"
    ssh linbird "cat /var/www/buckeyepredictions/predictions/predictions.sqlite" \
        | sudo -u apache tee /var/www/buckeyepredictions/predictions/predictions.sqlite >/dev/null
    exit 0
elif [ "$1" == "prod" ]; then
    MODE="prod"
    # git archive --format=tar.gz HEAD | ssh linbird "tar -C /var/www/buckeyepredictions -xzvf -"
    git ls-files | \
        xargs ls 2>&- | \
        xargs tar -cf - | \
        ssh linbird "tar -C /var/www/buckeyepredictions -xvf -"
    ssh linbird "service httpd restart"
    exit 0
fi

# Sanity checks
if [ "$SRC_DIR" == "$DST_DIR" ]; then
    echo "Error: Do not run this from the deployment target directory. Exiting."
    exit 1
fi

if [ $MODE == "dev" ] && [ ! -d ${DST_DIR} ]; then
    echo "Error: You are not able to push to production: \"${DST_DIR}\" not found to push to. Exiting."
    exit 2
fi

git ls-files |\
  xargs ls 2>&- |\
  xargs tar -c --owner=apache f - |\
  sudo -u apache tar -C /var/www/buckeyepredictions -xvf -

sudo service httpd restart

# for file in $(git ls-files); do
#     # Does the file even exist?
#     echo
# done
