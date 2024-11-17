#!/bin/bash
ADDRESS="tb1qecqc3f8cynfrsjhd62e0vfmsps9fv26zpuehk4"

while true; do
  bitcoin-cli generatetoaddress 1 "$ADDRESS"
  #sleep 0.1 # Optional: Pause for a second between block generations
done
