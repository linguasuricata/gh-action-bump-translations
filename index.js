const { Toolkit } = require('actions-toolkit');
const fs = require('fs');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
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

async function updateOnGitHub() {
  for (const repo of gitData.repos) {
    const url = `https://github.com/surikaterna/${repo}`;
    const ref = gitData.ref;

    try {
      const newPath = path.resolve(cwd(), `../${repo}`);
      shell.mkdir(newPath);
      shell.cd(newPath);

      await gitClone(url, ref);
      console.log('Cloned %s branch of %s.', ref, url);
      await initRepoWithTranslations();
      await updatePackageVersion();
      await gitAddAll();
      await gitCommit();
      await gitPush(ref);
      console.log('Successfully pushed the %s branch of %s.', ref, url);
    } catch (error) {
      console.error(error.message);
    }
  }
}

async function gitClone(url, ref) {
  await git.clone({
    fs,
    http,
    dir: cwd(),
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
      const newPath = path.resolve(cwd(), tempRepoPath);
      shell.mkdir(newPath);
      shell.cd(newPath);
      shell.exec('npm init -y');
      shell.exec('npm install');
      shell.exec(`npm config set '//registry.npmjs.org/:_authToken' "${process.env.NPM_TOKEN}"`);
      shell.exec(`npm install ${translationsRepoName} --save`);

      const packagePromise = getFile(fileNames.package);
      const packageLockPromise = getFile(fileNames.packageLock);
      const [package, packageLock] = await Promise.all([packagePromise, packageLockPromise]);
      const parsedPackage = JSON.parse(package.toString());
      const parsedPackageLock = JSON.parse(packageLock.toString());

      data.translationDep = {
        package: parsedPackage.dependencies[translationsRepoName],
        packageLock: parsedPackageLock.dependencies[translationsRepoName]
      };

      shell.cd('..');
      resolve();
    } catch (error) {
      console.log(error.message);
      reject(error);
    }
  });
};

const updatePackageVersion = () => new Promise((resolve, reject) => {
  npm.load({ save: true }, error => {
    if (error) {
      console.log(error.message);
      return reject(error);
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
      console.error(error.message);
      return reject(error);
    }
    resolve(data);
  });
});

function updateFile(fileName, translationDepData) {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await getFile(fileName);
      const parsedData = JSON.parse(data.toString());
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

async function gitAddAll() {
  const repo = {
    fs,
    dir: cwd()
  };

  const status = await git.statusMatrix(repo);
  await Promise.all(status.map(
    ([filepath, worktreeStatus]) => (worktreeStatus ? git.add({ ...repo, filepath }) : git.remove({
      ...repo,
      filepath
    }))
  ));
}

async function gitCommit() {
  const { message } = gitData;
  await git.commit({
    fs,
    dir: cwd(),
    author: { name: 'Bump Translations Action' },
    message
  });
}

async function gitPush(ref) {
  await git.push({
    fs,
    http,
    dir: cwd(),
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
