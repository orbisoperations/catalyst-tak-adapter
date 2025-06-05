#!/usr/bin/env bash

###
## This script is used to set the secrets for the app
## It is used in the CI/CD pipeline to set the secrets for the app
###

# load secrets from .env file
source .env

# set the secrets
## TAK Credentials
FLY_SECRET_TAK_KEY_CONTENT=$(cat ${TAK_KEY_FILE})
FLY_SECRET_TAK_CERT_CONTENT=$(cat ${TAK_CERT_FILE})

## TAK Endpoint
FLY_SECRET_TAK_ENDPOINT=$TAK_ENDPOINT
FLY_SECRET_TAK_CONNECTION_ID=$TAK_CONNECTION_ID
FLY_SECRET_CONSUMER_CATALYST_TOKEN=$CATALYST_TOKEN
FLY_SECRET_PRODUCER_CATALYST_APP_ID=$CATALYST_APP_ID
FLY_SECRET_CONSUMER_CATALYST_QUERY=$CONSUMER_CATALYST_QUERY

# check if the secrets exist in ENV
if [ -z "$FLY_SECRET_TAK_CERT_CONTENT" ]; then
  echo "FLY_SECRET_TAK_CERT_CONTENT is not set"
  exit 1
fi

if [ -z "$FLY_SECRET_TAK_KEY_CONTENT" ]; then
  echo "FLY_SECRET_TAK_KEY_CONTENT is not set"
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


if [ -z "$FLY_SECRET_PRODUCER_CATALYST_APP_ID" ]; then
  echo "FLY_SECRET_PRODUCER_CATALYST_APP_ID is not set"
  exit 1
fi

if [ -z "$FLY_SECRET_CONSUMER_CATALYST_QUERY" ]; then
  echo "FLY_SECRET_CONSUMER_CATALYST_QUERY is not set (this is an optional secret)"
fi

# set the secrets
fly secrets set RAW_KEY_AND_CERT='true'
fly secrets set FLY_SECRET_TAK_KEY_CONTENT="$FLY_SECRET_TAK_KEY_CONTENT"
fly secrets set FLY_SECRET_TAK_CERT_CONTENT="$FLY_SECRET_TAK_CERT_CONTENT"
fly secrets set FLY_SECRET_TAK_ENDPOINT="$FLY_SECRET_TAK_ENDPOINT"
fly secrets set FLY_SECRET_TAK_CONNECTION_ID="$FLY_SECRET_TAK_CONNECTION_ID"
fly secrets set FLY_SECRET_CONSUMER_CATALYST_TOKEN="$FLY_SECRET_CONSUMER_CATALYST_TOKEN"
# Special handling for the GraphQL query
fly secrets set FLY_SECRET_CONSUMER_CATALYST_QUERY="$(echo "$FLY_SECRET_CONSUMER_CATALYST_QUERY" | tr -d '\n' | sed 's/"/\\"/g')"
fly secrets set FLY_SECRET_PRODUCER_CATALYST_APP_ID="$FLY_SECRET_PRODUCER_CATALYST_APP_ID"
