FROM node:20

WORKDIR /

RUN git clone https://github.com/BioNGFF/vizarr
WORKDIR /vizarr

RUN git checkout 88b6f8128799cd946e93d46278d31a58e392bd62
RUN npx -y pnpm install
RUN npx pnpm run build

RUN mkdir /fractal-data

WORKDIR /fractal-data

ADD src src
ADD package* .
ADD tsconfig.json .

RUN npm install
RUN npm run build

ENV VIZARR_STATIC_FILES_PATH=/vizarr/dist

CMD ["node", "/fractal-data/dist/app.js"]
