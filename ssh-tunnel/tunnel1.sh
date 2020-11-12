chmod 400 ./eagle_nest.pem
ssh -i ./eagle_nest.pem -R 5002:localhost:6887 -N ubuntu@18.225.11.191 -v
