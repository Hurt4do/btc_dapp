#!/bin/bash

# ==============================================================================
# Script Name: create_multisig_wallet.sh
# Description: Automates the creation of a multisig wallet and generates an
#              unsigned PSBT using Bitcoin Core and Sparrow Wallets on Testnet4.
# Requirements:
#   - Bitcoin Core installed and configured.
#   - Sparrow Wallets set up for multisig with exported tpubs.
#   - jq installed for JSON processing.
#   - Three .txt files containing tpubs: tpub1.txt, tpub2.txt, tpub3.txt
# Usage:
#   chmod +x create_multisig_wallet.sh
#   ./create_multisig_wallet.sh
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# ------------------------------
# Function to display error messages
# ------------------------------
function error_exit {
    echo "Error: $1"
    exit 1
}

# ------------------------------
# Check for required files
# ------------------------------
for i in 1 2 3; do
    if [ ! -f "tpub${i}.txt" ]; then
        error_exit "File tpub${i}.txt not found in the current directory."
    fi
done

# ------------------------------
# Read tpubs from .txt files
# ------------------------------
tpub1=$(cat tpub1.txt | tr -d '\n')
tpub2=$(cat tpub2.txt | tr -d '\n')
tpub3=$(cat tpub3.txt | tr -d '\n')

echo "✔️  Successfully read tpubs from tpub1.txt, tpub2.txt, and tpub3.txt."

# ------------------------------
# Create a New Wallet in Bitcoin Core
# ------------------------------
wallet_name="multicore"
count=0

# Check if the wallet already exists and find an available wallet name
while bitcoin-cli -testnet4 listwallets | grep -q "$wallet_name"; do
    count=$((count + 1))
    wallet_name="multicore${count}"
done

# Save the wallet name to a file for later use
echo "$wallet_name" > last_wallet_name.txt

echo "🛠️  Creating a new descriptor wallet named '${wallet_name}' without private keys..."
create_wallet_output=$(bitcoin-cli -testnet4 createwallet "$wallet_name" true true)

echo "✔️  Wallet creation output:"
echo "$create_wallet_output"

# ------------------------------
# Verify Wallet Creation
# ------------------------------
echo "🔍 Verifying wallet creation..."
wallet_info=$(bitcoin-cli -testnet4 -rpcwallet="$wallet_name" getwalletinfo)

echo "🗒️  Wallet Info:"
echo "$wallet_info"

# Extract relevant fields for verification
private_keys_enabled=$(echo "$wallet_info" | jq -r '.private_keys_enabled')
descriptors_enabled=$(echo "$wallet_info" | jq -r '.descriptors')

if [ "$private_keys_enabled" != "false" ] || [ "$descriptors_enabled" != "true" ]; then
    error_exit "Wallet '${wallet_name}' was not created correctly. Please check the wallet settings."
fi

echo "✔️  Wallet '${wallet_name}' successfully created with descriptors enabled and private keys disabled."

# ------------------------------
# Construct the Multisig Descriptors
# ------------------------------
echo "✏️  Constructing multisig descriptors..."

# 4.1 External Descriptor (Receiving Addresses)
external_descriptor="wsh(sortedmulti(2, $tpub1/0/*, $tpub2/0/*, $tpub3/0/*))"
echo "🔗 External Descriptor:"
echo "$external_descriptor"

# 4.2 Internal Descriptor (Change Addresses)
internal_descriptor="wsh(sortedmulti(2, $tpub1/1/*, $tpub2/1/*, $tpub3/1/*))"
echo "🔗 Internal Descriptor:"
echo "$internal_descriptor"

# 4.3 Get Descriptors with Checksums
echo "🔍 Computing descriptors with checksums..."

external_descriptor_checksum=$(bitcoin-cli -testnet4 getdescriptorinfo "$external_descriptor" | jq -r '.descriptor')
internal_descriptor_checksum=$(bitcoin-cli -testnet4 getdescriptorinfo "$internal_descriptor" | jq -r '.descriptor')

echo "✔️  External Descriptor with Checksum:"
echo "$external_descriptor_checksum"

echo "✔️  Internal Descriptor with Checksum:"
echo "$internal_descriptor_checksum"

if [[ "$external_descriptor_checksum" != *#* ]] || [[ "$internal_descriptor_checksum" != *#* ]]; then
    error_exit "Descriptors do not contain checksums. Please verify the descriptors."
fi

# ------------------------------
# Create Import JSON
# ------------------------------
echo "📄 Creating import_descriptors.json..."

import_descriptors='[
  {
    "desc": "'"$external_descriptor_checksum"'",
    "active": true,
    "internal": false,
    "timestamp": "now",
    "range": [0,999]
  },
  {
    "desc": "'"$internal_descriptor_checksum"'",
    "active": true,
    "internal": true,
    "timestamp": "now",
    "range": [0,999]
  }
]'

echo "$import_descriptors" > descriptor_import.json

echo "✔️  descriptor_import.json created successfully."

# ------------------------------
# Import Descriptors into Bitcoin Core
# ------------------------------
echo "📥 Importing descriptors into the '${wallet_name}' wallet..."

import_output=$(bitcoin-cli -testnet4 -rpcwallet="$wallet_name" importdescriptors "$(cat descriptor_import.json)")

echo "✔️  Import Descriptors Output:"
echo "$import_output"

# ------------------------------
# Verify Wallet Info to Confirm Keypool Population
# ------------------------------
echo "🔍 Verifying keypool population..."

wallet_info_post_import=$(bitcoin-cli -testnet4 -rpcwallet="$wallet_name" getwalletinfo)

echo "🗒️  Wallet Info After Import:"
echo "$wallet_info_post_import"

# Extract keypool sizes for verification
keypoolsize=$(echo "$wallet_info_post_import" | jq -r '.keypoolsize')
keypoolsize_hd_internal=$(echo "$wallet_info_post_import" | jq -r '.keypoolsize_hd_internal')

echo "📊 Keypool Size (External): $keypoolsize"
echo "📊 Keypool Size (Internal): $keypoolsize_hd_internal"

if [ "$keypoolsize" -lt 1 ] || [ "$keypoolsize_hd_internal" -lt 1 ]; then
    error_exit "Keypool sizes are too low. Please check the descriptor import."
fi

echo "✔️  Keypool successfully populated."

# ------------------------------
# Generate a Receiving Address
# ------------------------------
echo "📬 Generating a new receiving address from the '${wallet_name}' wallet..."

receiving_address=$(bitcoin-cli -testnet4 -rpcwallet="$wallet_name" getnewaddress)

echo "✔️  Receiving Address Generated:"
echo "Receiving Address: $receiving_address"

# ------------------------------
# Save the Multisig Address to a File
# ------------------------------
echo "$receiving_address" > multisig_address.txt
echo "✔️  Multisig Address saved to multisig_address.txt"

# Optional: Display the multisig address
echo "🎉 Multisig Address: $receiving_address"

# ------------------------------
# End of Script
# ------------------------------
