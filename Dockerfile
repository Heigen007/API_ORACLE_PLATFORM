FROM oraclelinux:7-slim

# WORKDIR /stockapi
ENV NODE_ENV production
COPY . .

# Update Oracle Linux
# Install Node.js
# Install the Oracle Instant Client
# Check that Node.js and NPM installed correctly
# Install the OracleDB driver
RUN yum update -y && \
  yum install -y oracle-release-el7 && \
  yum install -y oracle-nodejs-release-el7 && \
  yum install -y nodejs && \
  yum install -y oracle-instantclient19.3-basic.x86_64 && \
  yum clean all && \
  node --version && \
  npm --version && \
  npm install && \
  echo Installed
  
EXPOSE 3000

CMD ["node","index.js"]