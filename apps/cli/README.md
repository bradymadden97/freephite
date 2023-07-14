## Installation and Setup
```
npm i -g @bradymadden97/freephite-cli

# Get a Github Access Token from https://github.com/settings/tokens
fp auth-fp -t <YOUR_GITHUB_ACCESS_TOKEN>
```


## (WIP) Develop Locally
```
git clone https://github.com/bradymadden97/freephite
cd freephite
yarn install

# Install turbo
npm i -g turbo
turbo build

# If you're working in ~/apps/cli run:
yarn build

# To test your local build
node ~path/to/freephite/apps/cli/dist/src/index.js
```
