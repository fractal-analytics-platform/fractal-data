FROM node:20

WORKDIR /

RUN git clone https://github.com/BioNGFF/vizarr
WORKDIR /vizarr

RUN git checkout 88b6f8128799cd946e93d46278d31a58e392bd62
RUN npm install -g pnpm@9
RUN pnpm install
RUN pnpm run build

RUN mkdir /fractal-data

WORKDIR /fractal-data

ADD src src
ADD package* /fractal-data/
ADD tsconfig.json /fractal-data/

RUN npm ci
RUN npm run build

ENV VIZARR_STATIC_FILES_PATH=/vizarr/dist

CMD ["node", "/fractal-data/dist/app.js"]
