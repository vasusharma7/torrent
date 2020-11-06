echo "Staring ssh-tunnel"
ssh -i ./ssh-tunnel/eagle_nest.pem -R 5000:localhost:6777 -N ubuntu@18.225.11.191 -v