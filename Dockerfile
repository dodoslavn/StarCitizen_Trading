FROM nodejs_sc-trading:latest
ARG FOLDER="/app"
WORKDIR ${FOLDER}
COPY StarCitizen_Trading/* ${FOLDER}
EXPOSE ${PORT}
ENTRYPOINT ["node" , "server.js" ]
