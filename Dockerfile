FROM debian:latest
RUN mkdir /app
WORKDIR /app
COPY StarCitizen_Trading/*.js /app
RUN apt-get clean
RUN apt-get update
RUN apt-get install -y nodejs 
EXPOSE 11081
ENTRYPOINT ["node" , "server.js" ]
