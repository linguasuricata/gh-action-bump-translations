## gh-action-bump-translations

Bump @surikat/lx-translations version in develop for the client and server everytime translations are published to npm.

### Workflow

* Clone the `develop` branches of the React client and API server.
* Run script `npm install @surikat/lx-translations@latest` for both repos.
* Push the updated package files to the `develop` branches.

### Usage:

* Add secrets for a GitHub username with access to the repositories and a personal access token with repo access.
* Add the workflow to GitHub Actions _AFTER_ the `npm publish` action:

```yml
- name: Bump Consumers
  uses: linguasuricata/gh-action-bump-translations
  env:
    USERNAME: ${{ secrets.USERNAME }}
    ACCESS_TOKEN: ${{ secrets.ACCESS_TOKEN }}
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
