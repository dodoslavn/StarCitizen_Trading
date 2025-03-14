FROM nodejs_sc-trading:latest
ARG FOLDER="/app"
WORKDIR ${FOLDER}
COPY StarCitizen_Trading/* ${FOLDER}
ENTRYPOINT ["node" , "server.js" ]
