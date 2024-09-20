#!/bin/bash

# Especificar el nombre de la wallet
WALLET_NAME="TestWallet"

# Paso 1: Verificar el saldo del monedero
BALANCE=$(bitcoin-cli -testnet -rpcwallet="$WALLET_NAME" getbalance)
echo "Saldo del Monedero: $BALANCE BTC"

# Comprobar si el saldo es inferior a 0.0001 BTC
if (( $(echo "$BALANCE < 0.0001" | bc -l) )); then
  echo "Fondos insuficientes para proceder. Saliendo..."
  exit 1
fi

# Paso 2: Listar transacciones no gastadas (UTXOs)
UTXOS=$(bitcoin-cli -testnet -rpcwallet="$WALLET_NAME" listunspent)
echo "UTXOs disponibles: $UTXOS"

# Paso 3: Extraer la información del primer UTXO
TXID=$(echo $UTXOS | jq -r '.[0].txid')
VOUT=$(echo $UTXOS | jq -r '.[0].vout')
AMOUNT=$(echo $UTXOS | jq -r '.[0].amount')

# Comprobar si se han encontrado UTXOs
if [ -z "$TXID" ] || [ -z "$VOUT" ]; then
  echo "No se encontraron UTXOs. Saliendo..."
  exit 1
fi

echo "UTXO seleccionado: TXID=$TXID, VOUT=$VOUT, Cantidad=$AMOUNT BTC"

# Paso 4: Definir la dirección del destinatario y la cantidad a enviar (ajustar estos valores)
RECIPIENT_ADDRESS="tb1q588x8ymje8quqvdnn56kfm2yjeme9vhfu2srgu"  # Reemplazar con la dirección real del destinatario
SEND_AMOUNT=0.0005  # Ajustar la cantidad a enviar

# Verificar si la cantidad a enviar es mayor que la cantidad disponible en el UTXO
if (( $(echo "$SEND_AMOUNT > $AMOUNT" | bc -l) )); then
  echo "Cantidad de UTXO insuficiente para enviar $SEND_AMOUNT BTC. Saliendo..."
  exit 1
fi

# Paso 5: Crear una transacción sin firmar
RAW_TX=$(bitcoin-cli -testnet -rpcwallet="$WALLET_NAME" createrawtransaction '[{"txid": "'"$TXID"'", "vout": '"$VOUT"'}]' '{"'"$RECIPIENT_ADDRESS"'": '"$SEND_AMOUNT"'}')
echo "Transacción sin firmar: $RAW_TX"

# Paso 6: Firmar la transacción sin firmar
SIGNED_TX=$(bitcoin-cli -testnet -rpcwallet="$WALLET_NAME" signrawtransactionwithwallet "$RAW_TX")
SIGNED_HEX=$(echo $SIGNED_TX | jq -r '.hex')
echo "Transacción firmada (Hex): $SIGNED_HEX"

# Paso 7: Transmitir la transacción firmada a la red
TXID_SENT=$(bitcoin-cli -testnet -rpcwallet="$WALLET_NAME" sendrawtransaction "$SIGNED_HEX")
echo "Transacción transmitida con TXID: $TXID_SENT"
