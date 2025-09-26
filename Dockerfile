FROM node:20

WORKDIR /

RUN git clone https://github.com/BioNGFF/biongff-viewer.git
WORKDIR /biongff-viewer

# modifying .gitmodules to use our vizarr fork
RUN sed -i 's|hms-dbmi|fractal-analytics-platform|g' .gitmodules
RUN printf "\tbranch = workaround-labels-bug\n" >> .gitmodules

RUN git submodule init
RUN git submodule update

RUN npx -y pnpm install
RUN npx pnpm --filter viewer run build
RUN npx pnpm --filter anndata-zarr run build
RUN npx pnpm --filter app run build --base /data/viewer

RUN mkdir /fractal-data

WORKDIR /fractal-data

ADD src src
ADD package* .
ADD tsconfig.json .

RUN npm install
RUN npm run build

ENV VIEWER_STATIC_FILES_PATH=/biongff-viewer/sites/app/dist

CMD ["node", "/fractal-data/dist/app.js"]
