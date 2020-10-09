const { Toolkit } = require('actions-toolkit');
const fs = require('fs');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const path = require('path');
const shell = require('shelljs');

const repos = [
  'lx-api-server',
  'lx-react-client'
];

const gitData = {
  repos,
  username: process.env.USERNAME,
  token: process.env.ACCESS_TOKEN,
  dir: process.env.HOME,
  message: 'Update translations'
};

Toolkit.run(async tools => {
  const name = '@surikat/lx-translations';
  const version = 'latest';

  updateOnGitHub(name, version);
});

function updateOnGitHub(name = '@surikat/lx-translations', version = 'latest') {
  gitData.repos.forEach(async repo => {
    const url = `https://github.com/surikaterna/${repo}`;
    const ref = 'develop-translations-test';
    const dir = path.join(gitData.dir, repo);

    await gitClone(url, ref, dir);
    await updatePackageVersion(name, version, dir);
    await gitAddAll(dir);
    await gitCommit(dir);
    await gitPush(ref, dir);
  });
}

async function gitClone(url, ref, dir) {
  await git.clone({
    fs,
    http,
    dir,
    url,
    ref,
    corsProxy: 'https://cors.isomorphic-git.org',
    onAuth,
    singleBranch: true,
    depth: 1
  });
}

async function updatePackageVersion(name, version, dir) {
  shell.cd(dir);
  if (shell.exec(`npm install ${name}@${version}`).code !== 0) {
    shell.echo('Error: npm command failed.');
    shell.exit(1);
  }
}

async function gitAddAll(dir) {
  const repo = {
    fs,
    dir
  };

  const status = await git.statusMatrix(repo);
  await Promise.all(status.map(
    ([filepath, worktreeStatus]) => (worktreeStatus ? git.add({ ...repo, filepath }) : git.remove({
      ...repo,
      filepath
    }))
  ));
}

async function gitCommit(dir) {
  const { message } = gitData;

  await git.commit({
    fs,
    dir,
    author: { name: 'Bump Translations Action' },
    message
  });
}

async function gitPush(ref, dir) {
  await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref,
    onAuth
  });
}

function onAuth() {
  const { token, username } = gitData;

  return {
    username,
    password: token
  };
}
