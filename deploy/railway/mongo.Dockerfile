FROM mongo:7.0
COPY deploy/railway/mongo-start.sh /usr/local/bin/railway-mongo-start
CMD ["bash", "/usr/local/bin/railway-mongo-start"]

