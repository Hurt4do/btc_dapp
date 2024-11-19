#!/bin/bash

# ==============================================================================
# Script Name: broadcast_psbt.sh
# Description: Combines signed PSBTs from cosigners, finalizes the transaction,
#              and broadcasts it to the Testnet4 Bitcoin network.
# Requirements:
#   - Bitcoin Core installed and configured.
#   - jq installed for JSON processing.
#   - Signed PSBT files from each cosigner.
# Usage:
#   chmod +x combine_finalize_broadcast_psbt.sh
#   ./combine_finalize_broadcast_psbt.sh
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
# Check for required signed PSBT files
# ------------------------------
if [ ! -f "sign1.txt" ]; then
    error_exit "File sign1.txt not found in the current directory."
fi

if [ ! -f "sign2.txt" ]; then
    error_exit "File sign2.txt not found in the current directory."
fi

if [ ! -f "last_wallet_name.txt" ]; then
    error_exit "File last_wallet_name.txt not found in the current directory."
fi

# ------------------------------
# Read Signed PSBTs into Variables
# ------------------------------
psbt1=$(cat sign1.txt)
psbt2=$(cat sign2.txt)

# ------------------------------
# Read Wallet Name from File
# ------------------------------
wallet_name=$(cat last_wallet_name.txt | tr -d '\n')
echo "Using wallet: $wallet_name"

# ------------------------------
# Combine the Signed PSBTs
# ------------------------------
echo "🛠️  Combining the signed PSBTs..."
combined_psbt=$(bitcoin-cli -testnet4 combinepsbt '["'"$psbt1"'", "'"$psbt2"'"]')
echo "✔️  Combined PSBT: $combined_psbt"

# ------------------------------
# Finalize the Combined PSBT
# ------------------------------
echo "🔍 Finalizing the combined PSBT..."
finalized_psbt=$(bitcoin-cli -testnet4 finalizepsbt "$combined_psbt")
echo "✔️  Finalized PSBT: $finalized_psbt"

# Extract the raw transaction hex
tx_hex=$(echo "$finalized_psbt" | jq -r '.hex')

# Check if the transaction is complete
is_complete=$(echo "$finalized_psbt" | jq -r '.complete')
if [ "$is_complete" != "true" ]; then
    error_exit "The PSBT could not be finalized. It may be missing signatures."
fi

# ------------------------------
# Broadcast the Transaction
# ------------------------------
echo "📡 Broadcasting the transaction to the network..."
txid=$(bitcoin-cli -testnet4 sendrawtransaction "$tx_hex")

echo "✔️  Transaction broadcasted with TXID: $txid"

# ------------------------------
# Verify the Transaction
# ------------------------------
echo "🔍 Verifying the broadcasted transaction..."
bitcoin-cli -testnet4 -rpcwallet="$wallet_name" gettransaction "$txid"

echo "🎉 Transaction successfully broadcasted. You can track it using the TXID: $txid"
