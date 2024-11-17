#!/bin/bash

# ==============================================================================
# Script Name: create_multisig_psbt_continue.sh
# Description: Continues the multisig process by creating a Partially Signed
#              Bitcoin Transaction (PSBT) for spending funds from the multisig wallet.
# Requirements:
#   - Bitcoin Core installed and configured.
#   - jq installed for JSON processing.
#   - Text files with necessary information.
# Usage:
#   chmod +x create_multisig_psbt_continue.sh
#   ./create_multisig_psbt_continue.sh
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
if [ ! -f "destination_address.txt" ]; then
    error_exit "File destination_address.txt not found in the current directory."
fi

if [ ! -f "min_balance.txt" ]; then
    error_exit "File min_balance.txt not found in the current directory."
fi

if [ ! -f "last_wallet_name.txt" ]; then
    error_exit "File last_wallet_name.txt not found in the current directory."
fi

# ------------------------------
# Read destination address, minimum balance, and wallet name from .txt files
# ------------------------------
destination_address=$(cat destination_address.txt | tr -d '\n')
min_balance=$(cat min_balance.txt | tr -d '\n')
wallet_name=$(cat last_wallet_name.txt | tr -d '\n')

echo "Destination address: $destination_address"
echo "Minimum balance required: $min_balance BTC"
echo "Using wallet: $wallet_name"

# ------------------------------
# Check Balance and Wait if Needed
# ------------------------------
balance=$(bitcoin-cli -testnet4 -rpcwallet="$wallet_name" getbalance)

while (( $(echo "$balance < $min_balance" | bc -l) )); do
    echo "⏳ Balance is insufficient ($balance BTC). Waiting for sufficient balance..."
    sleep 30
    balance=$(bitcoin-cli -testnet4 -rpcwallet="$wallet_name" getbalance)
done

echo "✔️  Sufficient balance available: $balance BTC"

# ------------------------------
# Calculate Amount to Send
# ------------------------------
# Send 80% of the available balance
amount=$(echo "$balance * 0.8" | bc -l | sed -e 's/^\./0./')
echo "Amount to send: $amount BTC"

echo "📝 Creating the PSBT..."
funded_psbt=$(bitcoin-cli -testnet4 -named -rpcwallet="$wallet_name" walletcreatefundedpsbt outputs="{\"$destination_address\": $amount}" | jq -r '.psbt')
echo "✔️  PSBT Created: $funded_psbt"

# ------------------------------
# Verify the PSBT
# ------------------------------
echo "🔍 Decoding the PSBT for verification..."
bitcoin-cli -testnet4 decodepsbt "$funded_psbt"

# ------------------------------
# Save the PSBT to a File
# ------------------------------
echo "💾 Saving the PSBT to unsigned.psbt..."
echo "$funded_psbt" > unsigned.psbt
echo "✔️  unsigned.psbt file created successfully: $funded_psbt"

echo "🎉 PSBT generation complete. The unsigned.psbt file is ready to be shared with cosigners."
