#!/bin/bash

# Load wallet01, wallet02, and regwallet for mining
WALLET1="./bitcoincli_wallet01.sh"
WALLET2="./bitcoincli_wallet02.sh"
REGWALLET="./bitcoincli_regwallet01.sh"

# Fixed transaction fee (0.001 BTC)
FEE=0.001

# Step 1: List UTXOs in wallet01 (get first available UTXO)
echo "Listing UTXOs from wallet01..."
UTXO=$($WALLET1 listunspent | jq -r '.[0] | {txid: .txid, vout: .vout, amount: .amount}')
TXID=$(echo $UTXO | jq -r '.txid')
VOUT=$(echo $UTXO | jq -r '.vout')
AMOUNT=$(echo $UTXO | jq -r '.amount')

echo "UTXO selected: txid=$TXID, vout=$VOUT, amount=$AMOUNT BTC"

# Step 2: Get an existing receiving address from wallet02
echo "Getting an existing receiving address from wallet02..."
RECEIVER=$($WALLET2 getaddressesbylabel "" | jq -r 'keys[0]')

# Step 3: Get an existing change address from wallet01
echo "Getting an existing change address from wallet01..."
CHANGE_ADDRESS=$($WALLET1 getaddressesbylabel "" | jq -r 'keys[0]')

echo "Sending 1 BTC to $RECEIVER from wallet02"
echo "Change will be sent to $CHANGE_ADDRESS in wallet01"

# Step 4: Calculate the change amount
# We send 1 BTC, so change = (AMOUNT - 1 BTC - FEE)
CHANGE=$(echo "$AMOUNT - 1 - $FEE" | bc)
echo "Change to be sent back to wallet01: $CHANGE BTC"

# Step 5: Create a raw transaction
echo "Creating raw transaction..."
RAW_TX=$($WALLET1 createrawtransaction "[{\"txid\":\"$TXID\",\"vout\":$VOUT}]" "{\"$RECEIVER\":1,\"$CHANGE_ADDRESS\":$CHANGE}")

echo "Raw transaction created: $RAW_TX"

# Step 6: Sign the raw transaction
echo "Signing raw transaction..."
SIGNED_TX=$($WALLET1 signrawtransactionwithwallet "$RAW_TX" | jq -r '.hex')

echo "Signed transaction: $SIGNED_TX"

# Step 7: Send the signed transaction
echo "Sending the signed transaction to the network..."
TXID_SENT=$($WALLET1 sendrawtransaction "$SIGNED_TX")

echo "Transaction sent successfully! TXID: $TXID_SENT"

# Step 8: Mine a block to confirm the transaction
# Using an existing address from regwallet01 to mine the block
echo "Getting an existing address from regwallet01 for mining..."
MINING_ADDRESS=$($REGWALLET getaddressesbylabel "" | jq -r 'keys[0]')

echo "Mining a block using the address: $MINING_ADDRESS"
BLOCK_MINED=$($REGWALLET generatetoaddress 1 "$MINING_ADDRESS")

echo "Block mined! Block hash: $BLOCK_MINED"

# Step 9: Check the balances
echo "Checking balances..."
BALANCE_WALLET1=$($WALLET1 getbalance)
BALANCE_WALLET2=$($WALLET2 getbalance)

echo "Wallet01 balance: $BALANCE_WALLET1 BTC"
echo "Wallet02 balance: $BALANCE_WALLET2 BTC"
