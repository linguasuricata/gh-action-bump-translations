const { Toolkit } = require('actions-toolkit');
const fs = require('fs');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const init = require('init-package-json');
const npm = require('npm');
const path = require('path');
const shell = require('shelljs');
const { cwd } = require('process');

const repos = [
  'lx-api-server',
  'lx-react-client'
];

const translationsRepoName = '@surikat/lx-translations';

const gitData = {
  repos,
  username: process.env.USERNAME,
  token: process.env.ACCESS_TOKEN,
  dir: process.env.HOME,
  ref: process.env.REF,
  message: 'Update translations'
};

const runCallback = async (_tools) => {
  updateOnGitHub();
};

const runOptions = {
  secrets: ['ACCESS_TOKEN', 'NPM_TOKEN', 'REF', 'USERNAME']
};

Toolkit.run(runCallback, runOptions);

function updateOnGitHub() {
  gitData.repos.forEach(async repo => {
    const url = `https://github.com/surikaterna/${repo}`;
    const ref = gitData.ref;
    const dir = gitData.dir;

    try {
      await gitClone(url, ref, dir);
      console.log('Cloned %s branch of %s.', ref, url);
      await initRepoWithTranslations();
      await updatePackageVersion(dir);
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

const data = {
  tempRepoPath: 'translations-repo',
  translationDep: {
    package: {},
    packageLock: {}
  }
};

const fileNames = {
  package: 'package.json',
  packageLock: 'package-lock.json'
};

const initRepoWithTranslations = () => {
  return new Promise(async (resolve, reject) => {
    const { tempRepoPath } = data;

    try {
      console.log('initRepoWithTranslations');
      shell.cd('..');

      const absPath = path.resolve(cwd(), tempRepoPath);
      console.log('absPath', absPath);
      shell.mkdir(absPath);
      shell.cd(absPath);

      shell.exec('npm init -y');
      shell.exec('npm install');
      console.log('Current location: ', cwd());

      const packagePromise = getFile(fileNames.package);
      const packageLockPromise = getFile(fileNames.packageLock);
      const [package, packageLock] = await Promise.all([packagePromise, packageLockPromise]);

      console.log('Package Files: ', package, packageLock);

      data.translationDep = {
        package: JSON.parse(package).dependencies[translationsRepoName],
        packageLock: JSON.parse(packageLock).dependencies[translationsRepoName]
      };

      console.log('DATA: ', JSON.stringify(data), null, 2);

      shell.cd('..');
      resolve();
    } catch (error) {
      console.log('ERROR: ', error.message);
      reject(error);
    }

    /* npm.load({ save: true }, error => {
      if (error) {
        console.log('load cb error: ', error);
        console.error(error);
        return reject(error);
      }

      console.log('will install');
      npm.commands.install([translationsRepoName], async error => {
        if (error) {
          console.error(error);
          return reject(error);
        }
        console.log(`Successfully installed ${translationsRepoName}`);

        const packagePromise = getFile(fileNames.package);
        const packageLockPromise = getFile(fileNames.packageLock);
        const [package, packageLock] = await Promise.all([packagePromise, packageLockPromise]);

        data.translationDep = {
          package: JSON.parse(package).dependencies[translationsRepoName],
          packageLock: JSON.parse(packageLock).dependencies[translationsRepoName]
        };

        shell.cd('..');
        resolve();
      });
      console.log('something');
    }); */
  });
};

const updatePackageVersion = (dir) => new Promise((resolve, reject) => {
  shell.cd(dir);
  console.log('Changed directory to %s.', dir);

  npm.load({ save: true }, err => {
    if (err) {
      console.error(err);
      return reject(err);
    }
    Promise.all([
      updateFile(fileNames.package, data.translationDep.package),
      updateFile(fileNames.packageLock, data.translationDep.packageLock)
    ]).then(resolve);
  });
});

const getFile = fileName => new Promise((resolve, reject) => {
  fs.readFile(fileName, (error, data) => {
    if (error) {
      console.error('getFile Error: ', error. message);
      return reject(error);
    }
    resolve(data);
  });
});

function updateFile(fileName, translationDepData) {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await getFile(fileName);
      const parsedData = JSON.parse(data);
      parsedData.dependencies[translationsRepoName] = translationDepData;
      const stringifiedData = JSON.stringify(parsedData, null, 2);

      fs.writeFile(fileName, stringifiedData, error => {
        if (error) {
          return reject(error);
        }
        resolve();
      });
    } catch (error) {
      console.error(error);
      reject(error);
    }
  });
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
