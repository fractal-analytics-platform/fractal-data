FROM node:20

WORKDIR /

RUN git clone https://github.com/hms-dbmi/vizarr.git
WORKDIR /vizarr

RUN git checkout eb2b77fed92a08c78c5770144bc7ccf19e9c7658
RUN npx -y pnpm install
RUN npx pnpm run build

RUN mkdir /fractal-data

WORKDIR /fractal-data

ADD src src
ADD package* .
ADD tsconfig.json .

RUN npm run install:aws
RUN npm run build

ENV VIZARR_STATIC_FILES_PATH=/vizarr/dist

CMD ["node", "/fractal-data/dist/app.js"]
