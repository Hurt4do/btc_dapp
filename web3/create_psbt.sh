#!/bin/bash

# ==============================================================================
# Script Name: create_psbt.sh
# Description: Verifies the wallet balance and creates a PSBT transaction
#              to send the expected amount to the destination address.
#              Checks that there are no unconfirmed transactions and that
#              the balance is sufficient.
# Requirements:
#   - Bitcoin Core installed and configured.
#   - jq installed for JSON processing.
#   - Necessary data files with required information.
# Usage:
#   chmod +x create_psbt.sh
#   ./create_psbt.sh
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# ------------------------------
# Set locale to ensure consistent decimal separator
# ------------------------------
export LC_ALL=C

# ------------------------------
# Function to display error messages
# ------------------------------
function error_exit {
    echo "❌ Error: $1"
    exit 1
}

# ------------------------------
# Check for required dependencies
# ------------------------------
command -v bitcoin-cli >/dev/null 2>&1 || { error_exit "bitcoin-cli is not installed. Please install Bitcoin Core."; }
command -v jq >/dev/null 2>&1 || { error_exit "jq is not installed. Please install jq."; }
command -v awk >/dev/null 2>&1 || { error_exit "awk is not installed. Please install awk."; }
command -v bc >/dev/null 2>&1 || { error_exit "bc is not installed. Please install bc."; }

# ------------------------------
# Define network parameters (Testnet)
# ------------------------------
NETWORK="-testnet4"  # Change this to "-testnet" or remove if using mainnet

# ------------------------------
# Check for required files
# ------------------------------
destination_address_file="./data/destination_address.txt"
balances_json_file="./data/funding/balances.json"
wallet_name_file="./data/last_wallet_name.txt"

if [ ! -f "$destination_address_file" ]; then
    error_exit "Destination address file '$destination_address_file' not found."
fi

if [ ! -f "$balances_json_file" ]; then
    error_exit "Balances JSON file '$balances_json_file' not found."
fi

if [ ! -f "$wallet_name_file" ]; then
    error_exit "Wallet name file '$wallet_name_file' not found."
fi

# ------------------------------
# Read destination address, expected amount, and wallet name from files
# ------------------------------
destination_address=$(cat "$destination_address_file" | tr -d '\n')
expected_amount=$(jq -r '.expected_amount' "$balances_json_file")
wallet_name=$(cat "$wallet_name_file" | tr -d '\n')

# Verify that the values are not empty
if [ -z "$destination_address" ]; then
    error_exit "Destination address is empty in '$destination_address_file'."
fi

if [ -z "$expected_amount" ]; then
    error_exit "Expected amount is not defined in '$balances_json_file'."
fi

if [ -z "$wallet_name" ]; then
    error_exit "Wallet name is empty in '$wallet_name_file'."
fi

echo "🔗 Destination Address: $destination_address"
echo "💰 Expected Amount to Send: $expected_amount BTC"
echo "🔐 Using Wallet: $wallet_name"

# ------------------------------
# Get wallet balances
# ------------------------------
echo "💱 Retrieving wallet balances..."
balances_json=$(bitcoin-cli $NETWORK -rpcwallet="$wallet_name" getbalances)

trusted_balance=$(echo "$balances_json" | jq -r '.mine.trusted')
untrusted_pending=$(echo "$balances_json" | jq -r '.mine.untrusted_pending')

if [ -z "$trusted_balance" ] || [ -z "$untrusted_pending" ]; then
    error_exit "Could not retrieve wallet balances."
fi

echo "💰 Trusted Balance: $trusted_balance BTC"
echo "⏳ Untrusted Pending Balance: $untrusted_pending BTC"

# ------------------------------
# Convert untrusted_pending to a decimal number using awk
# ------------------------------
untrusted_pending_numeric=$(echo "$untrusted_pending" | awk '{printf "%.8f", $1}')

# ------------------------------
# Wait for untrusted pending balance to become zero
# ------------------------------
while (( $(echo "$untrusted_pending_numeric < 0" | bc -l) )); do
    echo "⏳ Waiting for unconfirmed transactions to be confirmed..."
    sleep 30
    balances_json=$(bitcoin-cli $NETWORK -rpcwallet="$wallet_name" getbalances)
    untrusted_pending=$(echo "$balances_json" | jq -r '.mine.untrusted_pending')
    echo "⏳ Untrusted Pending Balance: $untrusted_pending BTC"

    # Convert untrusted_pending to decimal
    untrusted_pending_numeric=$(echo "$untrusted_pending" | awk '{printf "%.8f", $1}')
done

echo "✔️  All transactions are confirmed."

# ------------------------------
# Calculate total expected amount including 5% extra
# ------------------------------
expected_total_with_fee=$(echo "scale=8; $expected_amount * 1.05" | bc)

# ------------------------------
# Check if trusted balance is sufficient
# ------------------------------
if (( $(echo "$trusted_balance < $expected_total_with_fee" | bc -l) )); then
    error_exit "Trusted balance ($trusted_balance BTC) is less than the expected amount including fees ($expected_total_with_fee BTC)."
fi

echo "✔️  Trusted balance is sufficient."

# ------------------------------
# Create the PSBT
# ------------------------------
echo "📝 Creating the PSBT..."

# Create outputs JSON
outputs="{\"$destination_address\":$expected_amount}"

# Create the PSBT
psbt=$(bitcoin-cli $NETWORK -rpcwallet="$wallet_name" walletcreatefundedpsbt [] "$outputs" 0 '{"includeWatching":true}' | jq -r '.psbt')

if [ -z "$psbt" ]; then
    error_exit "Failed to create PSBT."
fi

echo "✔️  PSBT Created."

# ------------------------------
# Decode the PSBT for verification
# ------------------------------
echo "🔍 Decoding the PSBT for verification..."
decoded_psbt=$(bitcoin-cli $NETWORK decodepsbt "$psbt")
echo "$decoded_psbt"

# ------------------------------
# Save the PSBT to a JSON file
# ------------------------------
psbt_file="./data/unsigned_psbt.json"
echo "{\"psbt\": \"$psbt\"}" > "$psbt_file"
echo "💾 PSBT saved to '$psbt_file'."

echo "🎉 PSBT generation complete. The unsigned PSBT is ready to be shared with cosigners."
