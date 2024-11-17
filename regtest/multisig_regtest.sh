# Step 1: Load wallets
#bitcoin-cli loadwallet legacy_wallet01
#bitcoin-cli loadwallet legacy_wallet02
#bitcoin-cli loadwallet legacy_wallet03
#bitcoin-cli loadwallet regwallet01

# Step 2: Ensure regwallet01 has funds by mining blocks
mining_address="bcrt1qk49vz3xzjzg86lnpu595a9yvv7vahju0mcup0e"
#bitcoin-cli -rpcwallet=regwallet01 generatetoaddress 101 $mining_address

# Step 3: Send 10 BTC from regwallet01 to legacy_wallet01
legacy_wallet01_address="bcrt1q4xwjl5y4yunsedqyl8fvav52xuwyywkzazpwzp"
bitcoin-cli -rpcwallet=regwallet01 sendtoaddress $legacy_wallet01_address 10

# Step 4: Mine a block to confirm the transaction
bitcoin-cli -rpcwallet=regwallet01 generatetoaddress 1 $mining_address

# Step 5: Create the 3-of-3 multisig address in legacy_wallet02 using provided pubkeys
pubkey1="0313bbc1c725e1e4f7e268bd50a2237beb4efc7285fcbb753424ef856e9dd1d7a2"  # legacy_wallet01
pubkey2="020ca7898d60a390d5af5767203f7cad965adcce750cafb5a2c83ebec62164c6d4"  # legacy_wallet02
pubkey3="0252f867c2dea20094f05b7091d1e73cf7a7eec98bed938150e1ad7ce3fc08c4e0"  # legacy_wallet03

multisig_info=$(bitcoin-cli -rpcwallet=legacy_wallet02 createmultisig 3 "[\"$pubkey1\",\"$pubkey2\",\"$pubkey3\"]")
multisig_address=$(echo $multisig_info | jq -r '.address')
redeem_script=$(echo $multisig_info | jq -r '.redeemScript')

# Step 6: Import the multisig address and redeem script into all wallets
bitcoin-cli -rpcwallet=legacy_wallet01 importmulti '[{ "desc": "sh(multi(3,'$pubkey1','$pubkey2','$pubkey3'))", "redeemscript": "'$redeem_script'", "timestamp": "now", "label": "3-of-3 Multisig", "watchonly": false }]'
bitcoin-cli -rpcwallet=legacy_wallet02 importmulti '[{ "desc": "sh(multi(3,'$pubkey1','$pubkey2','$pubkey3'))", "redeemscript": "'$redeem_script'", "timestamp": "now", "label": "3-of-3 Multisig", "watchonly": false }]'
bitcoin-cli -rpcwallet=legacy_wallet03 importmulti '[{ "desc": "sh(multi(3,'$pubkey1','$pubkey2','$pubkey3'))", "redeemscript": "'$redeem_script'", "timestamp": "now", "label": "3-of-3 Multisig", "watchonly": false }]'

# Step 7: Send 1 BTC from legacy_wallet01 to the multisig address
bitcoin-cli -rpcwallet=legacy_wallet01 sendtoaddress $multisig_address 1

# Step 8: Mine a block to confirm the transaction
bitcoin-cli -rpcwallet=regwallet01 generatetoaddress 1 $mining_address

# Step 9: In legacy_wallet02, find the UTXO for the multisig address
utxos=$(bitcoin-cli -rpcwallet=legacy_wallet02 listunspent 1 9999999 '["'$multisig_address'"]')
txid=$(echo $utxos | jq -r '.[0].txid')
vout=$(echo $utxos | jq -r '.[0].vout')
amount=$(echo $utxos | jq -r '.[0].amount')

# Step 10: Prepare to send funds to legacy_wallet03
legacy_wallet03_address="bcrt1qy59e7tk5fsdsjzx4f3njzfjntvyu70xm28xc6j"
fee=0.001
amount_to_send=$(echo "$amount - $fee" | bc)

# Step 11: Create the raw transaction in legacy_wallet02
raw_tx=$(bitcoin-cli -rpcwallet=legacy_wallet02 createrawtransaction \
    '[{"txid":"'$txid'","vout":'$vout'}]' \
    '{"'$legacy_wallet03_address'":'$amount_to_send'}')

# Step 12: Add the redeem script to the transaction
funded_tx=$(bitcoin-cli -rpcwallet=legacy_wallet02 fundrawtransaction $raw_tx '{"subtractFeeFromOutputs":[0]}')

# Step 13: Sign the transaction in legacy_wallet02
signed_tx1=$(bitcoin-cli -rpcwallet=legacy_wallet02 signrawtransactionwithwallet $(echo $funded_tx | jq -r '.hex'))
partial_hex1=$(echo $signed_tx1 | jq -r '.hex')

# Step 14: Sign the transaction in legacy_wallet01
signed_tx2=$(bitcoin-cli -rpcwallet=legacy_wallet01 signrawtransactionwithwallet $partial_hex1)
partial_hex2=$(echo $signed_tx2 | jq -r '.hex')

# Step 15: Sign the transaction in legacy_wallet03
signed_tx3=$(bitcoin-cli -rpcwallet=legacy_wallet03 signrawtransactionwithwallet $partial_hex2)
final_hex=$(echo $signed_tx3 | jq -r '.hex')
complete=$(echo $signed_tx3 | jq -r '.complete')

# Step 16: Check if the transaction is fully signed
if [ "$complete" != "true" ]; then
  echo "Transaction is not fully signed."
  exit 1
fi

# Step 17: Broadcast the transaction
txid=$(bitcoin-cli -rpcwallet=legacy_wallet03 sendrawtransaction $final_hex)
echo "Transaction sent. TXID: $txid"

# Step 18: Mine a block to confirm the transaction
bitcoin-cli -rpcwallet=regwallet01 generatetoaddress 1 $mining_address

# Step 19: Check the balance of legacy_wallet03
balance=$(bitcoin-cli -rpcwallet=legacy_wallet03 getbalance)
echo "Legacy_wallet03 balance: $balance BTC"
