#!/bin/sh
# Aplica as migrations pendentes e sobe a API
set -e

yarn -s typeorm migration:run
exec yarn -s start
