#!/usr/bin/env bash

###
## This script is used to set the secrets for the app
## It is used in the CI/CD pipeline to set the secrets for the app
###

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file"
    set -a  # automatically export all variables
    source .env
    set +a
fi

# check if the secrets exist in ENV
if [ -z "$FLY_SECRET_TAK_KEY_FILE" ]; then
  echo "FLY_SECRET_TAK_KEY_FILE is not set"
  exit 1
fi

if [ -z "$FLY_SECRET_TAK_CERT_FILE" ]; then
  echo "FLY_SECRET_TAK_CERT_FILE is not set"
  exit 1
fi

if [ -z "$FLY_SECRET_TAK_ENDPOINT" ]; then
  echo "FLY_SECRET_TAK_ENDPOINT is not set"
  exit 1
fi

if [ -z "$FLY_SECRET_TAK_CONNECTION_ID" ]; then
  echo "FLY_SECRET_TAK_CONNECTION_ID is not set"
  exit 1
fi

if [ -z "$FLY_SECRET_CONSUMER_CATALYST_TOKEN" ]; then
  echo "FLY_SECRET_CONSUMER_CATALYST_TOKEN is not set"
  exit 1
fi

if [ -z "$FLY_SECRET_CONSUMER_CATALYST_QUERY" ]; then
  echo "FLY_SECRET_CONSUMER_CATALYST_QUERY is not set"
  exit 1
fi

if [ -z "$FLY_SECRET_PRODUCER_CATALYST_APP_ID" ]; then
  echo "FLY_SECRET_PRODUCER_CATALYST_APP_ID is not set"
  exit 1
fi

# set the secrets
fly secrets set FLY_SECRET_TAK_KEY_FILE="$FLY_SECRET_TAK_KEY_FILE"
fly secrets set FLY_SECRET_TAK_CERT_FILE="$FLY_SECRET_TAK_CERT_FILE"
fly secrets set FLY_SECRET_TAK_ENDPOINT="$FLY_SECRET_TAK_ENDPOINT"
fly secrets set FLY_SECRET_TAK_CONNECTION_ID="$FLY_SECRET_TAK_CONNECTION_ID"
fly secrets set FLY_SECRET_CONSUMER_CATALYST_TOKEN="$FLY_SECRET_CONSUMER_CATALYST_TOKEN"
# Special handling for the GraphQL query
fly secrets set FLY_SECRET_CONSUMER_CATALYST_QUERY="$(echo "$FLY_SECRET_CONSUMER_CATALYST_QUERY" | tr -d '\n' | sed 's/"/\\"/g')"
fly secrets set FLY_SECRET_PRODUCER_CATALYST_APP_ID="$FLY_SECRET_PRODUCER_CATALYST_APP_ID"
