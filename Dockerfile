FROM node:boron

WORKDIR /usr/src/app

COPY package.json .

RUN npm install

COPY . .

EXPOSE 53
EXPOSE 53/udp

CMD [ "npm", "start" ]

