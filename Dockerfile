FROM node:carbon-alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install && yarn global add forever

COPY . .

EXPOSE 53
EXPOSE 53/udp
EXPOSE 5959

CMD [ "npm", "start" ]
