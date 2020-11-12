chmod 400 ./eagle_nest.pem
ssh -i ./eagle_nest.pem -R 5004:localhost:6887 -N ubuntu@18.225.11.191 -v
