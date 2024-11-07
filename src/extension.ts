import * as vscode from 'vscode';
const fs = require('fs');
const path = require('path');

const wxTags = [
  'movable-view', 'cover-image', 'cover-view', 'movable-area', 'scroll-view',
  'swiper', 'swiper-item', 'view', 'icon', 'progress', 'rich-text', 'text',
  'button', 'checkbox', 'checkbox-group', 'editor', 'form', 'input', 'label',
  'picker', 'picker-view', 'picker-view-column', 'radio', 'radio-group', 'slider',
  'switch', 'textarea', 'functional-page-navigator', 'navigator', 'audio', 'camera',
  'image', 'live-player', 'live-pusher', 'video', 'map', 'canvas', 'ad',
  'official-account', 'open-data', 'web-view',
];

const appFile = 'tsconfig.json';
let rootPath = '';

function lastLevelDir(filePath: string): string {
  return path.dirname(filePath);
}

function findRootPath(filePath: string): string {
  const dir = lastLevelDir(filePath);
  const files = fs.readdirSync(dir);

  if (files.includes('tsconfig.json') || files.includes('jsconfig.json')) {
    return dir;
  } else {
    return findRootPath(dir);
  }
}

function loadAliasMap(): Record<string, string> {
  const tsconfigPath = path.join(rootPath, 'tsconfig.json');
  const jsconfigPath = path.join(rootPath, 'jsconfig.json');
  const aliasMap: Record<string, string> = {};

  let configPath = '';
  if (fs.existsSync(tsconfigPath)) {
    configPath = tsconfigPath;
  } else if (fs.existsSync(jsconfigPath)) {
    configPath = jsconfigPath;
  }

  if (configPath) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const paths = config.compilerOptions?.paths || {};

      for (const alias in paths) {
        const actualPath = paths[alias][0].replace('/*', '');
        aliasMap[alias.replace('/*', '')] = actualPath;
      }
    } catch (error) {
      console.error(`Error parsing ${configPath}:`, error);
    }
  }

  return aliasMap;
}

function resolveAliasPath(aliasPath: string, aliasMap: Record<string, string>): string | null {
  for (const alias in aliasMap) {
    if (aliasPath.startsWith(alias)) {
      return aliasPath.replace(alias, aliasMap[alias]);
    }
  }
  return null; // 不处理相对路径引入的情况
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      [{ scheme: 'file', language: 'wxml', pattern: '**/*.wxml' }],
      {
        provideDefinition(
          doc: vscode.TextDocument,
          position: vscode.Position,
          token: vscode.CancellationToken,
        ) {
          const lineText = doc.lineAt(position).text;
          const wordRange = doc.getWordRangeAtPosition(position, /[\w|\-]+\b/);
          const tag = (lineText.match(/(?<=<\/?)[\w|\-]+\b/) || [])[0];
          const word = doc.getText(wordRange);

          if (!tag || tag !== word || wxTags.includes(tag)) {
            return;
          }

          const filePath = doc.fileName;
          let jsonFile = filePath.replace('.wxml', '.json');

          if (!rootPath) {
            rootPath = findRootPath(filePath);
          }

          const aliasMap = loadAliasMap();

          let config;
          try {
            config = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
          } catch (error) {
            console.error('Error reading component config:', error);
            return;
          }

          let compPath;

          if (config.usingComponents && config.usingComponents[tag]) {
            compPath = config.usingComponents[tag];
            compPath = resolveAliasPath(compPath, aliasMap);
          }

          if (!compPath) {
            jsonFile = path.join(rootPath, "src/app.json");
            try {
              config = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
            } catch (error) {
              console.error('Error reading global config:', error);
              return;
            }

            if (config.usingComponents && config.usingComponents[tag]) {
              compPath = config.usingComponents[tag];
              compPath = resolveAliasPath(compPath, aliasMap);
            }
          }

          if (compPath) {
            let componentPath = path.join(rootPath, `${compPath}.ts`);
            if (!fs.existsSync(componentPath)) {
              componentPath = path.join(rootPath, `${compPath}.js`);
            }
            if (fs.existsSync(componentPath)) {
              return new vscode.Location(
                vscode.Uri.file(componentPath),
                new vscode.Position(0, 0),
              );
            }
          }
        },
      },
    ),
  );
}
