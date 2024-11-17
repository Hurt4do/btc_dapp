#!/bin/bash

echo "=== Beneficiary's Multisig Transaction Interface ==="
echo "1. Generate New Address and Public Key"
echo "2. Provide Public Key to Administrator"
echo "3. Sign Transaction"
echo "4. Exit"

while true; do
  echo -n "Select an option [1-4]: "
  read OPTION
  case $OPTION in
    1)
      BENEFICIARY_ADDRESS=$(./bitcoincli_beneficiary.sh getnewaddress)
      BENEFICIARY_PUBKEY=$(./bitcoincli_beneficiary.sh validateaddress "$BENEFICIARY_ADDRESS" | grep '"pubkey"' | cut -d '"' -f4)
      echo "Your Address: $BENEFICIARY_ADDRESS"
      echo "Your Public Key: $BENEFICIARY_PUBKEY"
      ;;
    2)
      echo "Please provide your public key to the Administrator."
      echo "Your Public Key: $BENEFICIARY_PUBKEY"
      ;;
    3)
      echo -n "Enter Raw Transaction Hex provided by Administrator: "
      read RAW_TX_HEX
      echo -n "Enter TXID: "
      read TXID
      echo -n "Enter VOUT: "
      read VOUT
      echo -n "Enter ScriptPubKey: "
      read SCRIPT_PUB_KEY
      echo -n "Enter Redeem Script: "
      read REDEEM_SCRIPT
      SIGNED_TX=$(./bitcoincli_beneficiary.sh signrawtransactionwithwallet "$RAW_TX_HEX" "[{\"txid\":\"$TXID\",\"vout\":$VOUT,\"scriptPubKey\":\"$SCRIPT_PUB_KEY\",\"redeemScript\":\"$REDEEM_SCRIPT\",\"amount\":5.0}]")
      SIGNED_TX_HEX=$(echo "$SIGNED_TX" | grep -oP '(?<=\"hex\": \")[^\"]*')
      echo "Your Partially Signed Transaction Hex: $SIGNED_TX_HEX"
      echo "Please provide this hex to the Administrator."
      ;;
    4)
      echo "Exiting..."
      break
      ;;
    *)
      echo "Invalid option."
      ;;
  esac
done
