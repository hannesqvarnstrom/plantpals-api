FROM node:18 AS builder

WORKDIR /usr/src
COPY ["package.json", "package-lock.json", "tsconfig.json", "migrate.js", "./"]
COPY "./drizzle" /usr/src/drizzle
COPY ./src ./src
RUN npm i
#EXPOSE 3000
RUN npm run build
ARG DATABASE_URL

ENV DATABASE_URL=$DATABASE_URL
# FROM node:18
# WORKDIR /usr/src
# COPY --from=builder /usr/src/dist ./dist
# COPY --from=builder /usr/src/package.json ./
# COPY --from=builder /usr/src/package-lock.json ./
# COPY --from=builder /usr/src/migrate.js ./
# COPY --from=builder /usr/src/drizzle ./
RUN npm ci --production
EXPOSE 3000

# comment out the line below when rebuilding the container, and run the migrations inside of the Docker container after it has started. The DB isnt created until later locally, so it needs to wait a bit.
# RUN npm run migrations:run

CMD ["node", "dist/index.js"]


# OLD DEV SETUP
# FROM node:18

# WORKDIR /usr/src
# COPY ["package.json", "package-lock.json", "tsconfig.json", "./"]
# COPY ./src ./src
# RUN npm i
# EXPOSE 3000
# CMD npm run dev

# # COPY ["package.json", "package-lock.json", "tsconfig.json", ".env", "./"]


# # FROM node:16.13.1-alpine3.14
# # WORKDIR /usr/src/app


# # COPY ./src ./src

# # RUN npm install

# # CMD npm run dev