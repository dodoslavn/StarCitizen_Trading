FROM debian:latest
ARG FOLDER="/app"
RUN mkdir ${FOLDER}
WORKDIR ${FOLDER}
COPY StarCitizen_Trading/*.js ${FOLDER}
RUN apt-get clean
RUN apt-get update
RUN apt-get install -y nodejs npm
RUN npm install node-cron
EXPOSE ${PORT}
ENTRYPOINT ["node" , "server.js" ]
