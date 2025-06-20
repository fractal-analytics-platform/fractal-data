FROM node:20

RUN mkdir /fractal-data

WORKDIR /fractal-data

ADD src src
ADD package* .
ADD tsconfig.json .

RUN npm install
RUN npm run build

CMD ["node", "/fractal-data/dist/app.js"]
