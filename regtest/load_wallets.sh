#!/bin/bash

# Load wallet01
wallet_json1=$(bitcoin-cli -regtest loadwallet "wallet01")
wallet_name1=$(echo "$wallet_json1" | jq -r '.name')
echo "Wallet '$wallet_name1' loaded successfully."

# Load wallet02
wallet_json2=$(bitcoin-cli -regtest loadwallet "wallet02")
wallet_name2=$(echo "$wallet_json2" | jq -r '.name')
echo "Wallet '$wallet_name2' loaded successfully."

# Load wallet03
wallet_json3=$(bitcoin-cli -regtest loadwallet "wallet03")
wallet_name3=$(echo "$wallet_json3" | jq -r '.name')
echo "Wallet '$wallet_name3' loaded successfully."

# Load regwallet01
wallet_json4=$(bitcoin-cli loadwallet "regwallet01")
wallet_name4=$(echo "$wallet_json4" | jq -r '.name')
echo "Wallet '$wallet_name4' loaded successfully."


echo "All wallets have been loaded."
