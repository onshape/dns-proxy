FROM node:carbon-alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

EXPOSE 53
EXPOSE 53/udp

CMD [ "node", "./index.js" ]
