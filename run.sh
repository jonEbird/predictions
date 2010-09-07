#!/bin/bash

REL_DIR="$(dirname $0)"

# I know, hackish...
cd $REL_DIR
./predictions.py
