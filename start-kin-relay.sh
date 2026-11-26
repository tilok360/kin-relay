#!/bin/sh
# Mac / Linux: start Kin Relay (needs Node.js 22 or newer from https://nodejs.org).
cd "$(dirname "$0")" && exec node server.js "$@"
