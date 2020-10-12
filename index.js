const { Toolkit } = require('actions-toolkit');
const fs = require('fs');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const npm = require('npm');
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
  ref: process.env.REF,
  message: 'Update translations'
};

const runCallback = async (_tools) => {
  const name = '@surikat/lx-translations';
  const version = 'latest';

  updateOnGitHub(name, version);
};

const runOptions = {
  secrets: ['ACCESS_TOKEN', 'NPM_TOKEN', 'REF', 'USERNAME']
};

Toolkit.run(runCallback, runOptions);

function updateOnGitHub(name = '@surikat/lx-translations', version = 'latest') {
  gitData.repos.forEach(async repo => {
    const url = `https://github.com/surikaterna/${repo}`;
    const ref = gitData.ref;
    const dir = path.join(gitData.dir, repo);

    try {
      await gitClone(url, ref, dir);
      console.log('Cloned %s branch of %s.', ref, url);
      await updatePackageVersion(name, version, dir);
      await gitAddAll(dir);
      await gitCommit(dir);
      await gitPush(ref, dir);
      console.log('Successfully pushed the %s branch of %s.', ref, url);
    } catch (err) {
      console.error(err);
    }
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

const updatePackageVersion = (name, version, dir) => new Promise((resolve, reject) => {
  shell.cd(dir);
  console.log('Changed directory to %s.', dir);
  npm.load({ save: true }, err => {
    if (err) {
      console.error(err);
      return reject(err);
    }

    const translationDep = `${name}@${version}`;
    npm.commands.install([translationDep], (err, _data) => {
      if (err) {
        console.error(err);
        return reject(err);
      }

      console.log(`Successfully installed ${translationDep}`);
      return resolve();
    });
  });
});

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
