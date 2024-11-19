#!/bin/bash

# ==============================================================================
# Script Name: get_tx_values.sh
# Description: Fetches and displays the values of transactions saved in txids.json
#              targeting the multisig address using Bitcoin Core.
#              Calculates expected contributions per user and determines funding status.
#              Saves detailed balances and funding requirements in balances.json.
# Requirements:
#   - Bitcoin Core installed and running with txindex=1.
#   - jq installed for JSON processing.
#   - JSON file containing txids per user: data/funding/txids.json
#   - Multisig address stored in data/funding/multisig_address.json
#   - Users list in data/users.json
#   - Expected total amount in data/funding/balances.json under "expected_amount"
# Usage:
#   chmod +x get_tx_values.sh
#   ./get_tx_values.sh
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

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

# ------------------------------
# Define network parameters (Testnet)
# ------------------------------
NETWORK="-testnet4"  # Change this to "-testnet" or remove if using mainnet

# ------------------------------
# Read the multisig address
# ------------------------------
multisig_address_file="./data/funding/multisig_address.json"
if [ ! -f "$multisig_address_file" ]; then
    error_exit "Multisig address file '$multisig_address_file' not found."
fi

multisig_address=$(jq -r '.multisig_address' "$multisig_address_file")
if [ -z "$multisig_address" ]; then
    error_exit "Multisig address in '$multisig_address_file' is empty."
fi

echo "🔗 Multisig Address: $multisig_address"
echo ""

# ------------------------------
# Read users from users.json
# ------------------------------
users_file="./data/users.json"
if [ ! -f "$users_file" ]; then
    error_exit "Users file '$users_file' not found."
fi

# Extract usernames into an array
users=($(jq -r '.[].username' "$users_file"))
num_users=${#users[@]}
if [ $num_users -eq 0 ]; then
    error_exit "No users found in '$users_file'."
fi

# ------------------------------
# Read expected amount from balances.json
# ------------------------------
balances_json_file="./data/funding/balances.json"
if [ ! -f "$balances_json_file" ]; then
    error_exit "Balances JSON file '$balances_json_file' not found."
fi

expected_amount=$(jq -r '.expected_amount' "$balances_json_file")
if [ -z "$expected_amount" ]; then
    error_exit "Expected amount is not defined in '$balances_json_file'."
fi

echo "💰 Expected Total Amount: $expected_amount BTC"

# Calculate expected amount per user with 5% extra
expected_amount_per_user=$(echo "scale=8; $expected_amount / $num_users * 1.05" | bc)
echo "💰 Expected Amount per User (with 5% extra): $expected_amount_per_user BTC"
echo ""

# Convert expected_amount_per_user to mBTC
expected_amount_per_user_mbtc=$(echo "$expected_amount_per_user * 1000" | bc -l | sed 's/\.*0*$//')

# ------------------------------
# Read txids from txids.json
# ------------------------------
txids_file="./data/funding/txids.json"
if [ ! -f "$txids_file" ]; then
    error_exit "TxIDs JSON file '$txids_file' not found."
fi

# Read txids as an array of strings
txids_array=($(jq -r '.[]' "$txids_file"))
txids_length=${#txids_array[@]}

# Ensure that the number of txids matches the number of users
if [ "$txids_length" -ne "$num_users" ]; then
    error_exit "Number of txids ($txids_length) does not match number of users ($num_users)."
fi

# ------------------------------
# Function to get amount sent to multisig address in a tx using getrawtransaction
# ------------------------------
function get_tx_amount_to_multisig {
    local txid=$1
    local address=$2

    # Get raw transaction in JSON format
    tx_json=$(bitcoin-cli $NETWORK getrawtransaction "$txid" true 2>/dev/null) || {
        echo "Transaction not found"
        echo "0"
        return
    }

    # Initialize amount to zero
    amount=0

    # Loop through vout to find outputs to the multisig address
    vout_length=$(echo "$tx_json" | jq '.vout | length')
    for ((j=0; j<vout_length; j++)); do
        vout=$(echo "$tx_json" | jq ".vout[$j]")
        # Try to get the address from 'scriptPubKey.addresses' array
        addresses=$(echo "$vout" | jq -r '.scriptPubKey.addresses[]?')
        if [ -z "$addresses" ]; then
            # If 'addresses' array doesn't exist, try 'scriptPubKey.address'
            addresses=$(echo "$vout" | jq -r '.scriptPubKey.address // empty')
        fi

        # If no addresses found, skip this output
        if [ -z "$addresses" ]; then
            continue
        fi

        # Loop through all addresses in 'addresses'
        for addr in $addresses; do
            if [ "$addr" == "$address" ]; then
                value=$(echo "$vout" | jq -r '.value // empty')
                if [ -n "$value" ]; then
                    amount=$(echo "$amount + $value" | bc -l)
                fi
            fi
        done
    done

    # If amount is empty, set to 0
    if [ -z "$amount" ]; then
        echo "0"
    else
        # Ensure leading zero for amounts starting with a decimal
        if [[ "$amount" =~ ^\.[0-9]+$ ]]; then
            echo "0$amount"
        else
            echo "$amount"
        fi
    fi
}

# ------------------------------
# Initialize variables for JSON output
# ------------------------------
balances_json="./data/funding/balances.json"

# Ensure the directory exists
mkdir -p "$(dirname "$balances_json")"

# Initialize an empty array for users_balances
declare -a users_balances_array=()

# Initialize total balance in mBTC
total_mbtc=0

# ------------------------------
# Fetch and process transaction values per user
# ------------------------------
echo "📥 Fetching transaction values per user targeting the multisig address..."
echo "---------------------------------------------------------------"

for ((i=0; i<num_users; i++)); do
    user="${users[$i]}"
    echo "👤 User: $user"

    # Get the TxID for this user
    txid="${txids_array[$i]}"
    user_txids_array=("$txid")

    user_total_amount_mbtc=0
    user_tx_values=()

    if [ -z "$txid" ]; then
        echo "  📝 No TxID found for user."
    else
        echo "  📝 TxID: $txid"
        amount=$(get_tx_amount_to_multisig "$txid" "$multisig_address")

        # Check if amount is numeric
        if [[ "$amount" =~ ^-?[0-9]+(\.[0-9]+)?$ ]]; then
            # Convert amount from BTC to mBTC
            amount_mbtc=$(echo "$amount * 1000" | bc -l | sed 's/\.*0*$//')
            echo "    💰 Amount Sent to Multisig: $amount_mbtc mBTC"
            # Accumulate user total in mBTC
            user_total_amount_mbtc=$(echo "$user_total_amount_mbtc + $amount_mbtc" | bc -l)
        else
            echo "    💰 Amount Sent to Multisig: $amount"
            amount_mbtc="0"
        fi

        # Append txid and amount to user's tx_values
        user_tx_values+=("{\"txid\": \"${txid}\", \"amount_mbtc\": \"${amount_mbtc}\"}")
    fi

    # Remove trailing zeros from user total
    user_total_amount_mbtc=$(echo "$user_total_amount_mbtc" | sed 's/\.*0*$//')

    # Accumulate total balance
    total_mbtc=$(echo "$total_mbtc + $user_total_amount_mbtc" | bc -l)

    # Calculate amount remaining for user
    amount_remaining_mbtc=$(echo "$expected_amount_per_user_mbtc - $user_total_amount_mbtc" | bc -l)
    # If amount_remaining_mbtc is negative or zero, set to 0
    if (( $(echo "$amount_remaining_mbtc <= 0" | bc -l) )); then
        amount_remaining_mbtc="0"
    else
        # Remove trailing zeros
        amount_remaining_mbtc=$(echo "$amount_remaining_mbtc" | sed 's/\.*0*$//')
    fi

    # Create user balance object
    user_balance="{\"username\": \"$user\", \"expected_amount_mbtc\": \"$expected_amount_per_user_mbtc\", \"total_sent_mbtc\": \"$user_total_amount_mbtc\", \"amount_remaining_mbtc\": \"$amount_remaining_mbtc\", \"tx_values\": [$(IFS=,; echo "${user_tx_values[*]}")]}"
    # Append user balance to array
    users_balances_array+=("$user_balance")

    echo "  📊 Total Sent by $user: $user_total_amount_mbtc mBTC"
    echo "  📈 Amount Remaining for $user: $amount_remaining_mbtc mBTC"
    echo ""
done

# Remove trailing zeros from total
total_mbtc=$(echo "$total_mbtc" | sed 's/\.*0*$//')

# ------------------------------
# Generate balances.json
# ------------------------------
echo "📊 Generating balances.json..."

jq -n \
    --argjson users_balances "[ $(IFS=,; echo "${users_balances_array[*]}") ]" \
    --arg total_mbtc "$total_mbtc" \
    --arg expected_amount "$expected_amount" \
    --arg expected_amount_per_user "$expected_amount_per_user" \
    '{users_balances: $users_balances, total_mbtc: $total_mbtc, expected_amount: $expected_amount, expected_amount_per_user: $expected_amount_per_user}' > "$balances_json"

echo "✅ balances.json has been updated at '$balances_json'."
echo "---------------------------------------------------------------"
echo "📊 Total Amount Sent to Multisig Address: $total_mbtc mBTC"
echo "---------------------------------------------------------------"
