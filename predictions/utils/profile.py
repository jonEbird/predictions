#!/bin/env python

import imghdr

def is_valid_picture(filename):
    """Returns the image format or None when it is not a valid image"""
    try:
        return imghdr.what(filename)
    except (IOError, OSError), e:
        return None
