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
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8').replace(/,(\s*[\]}])/g, '$1'));
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
  return null;
}

function getConfig() {
  return vscode.workspace.getConfiguration('miniCustomComponentJump');
}

function tryOpenFile(basePath: string, fileTypes: string[]): string | null {
  for (const type of fileTypes) {
    const filePath = `${basePath}.${type}`;
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
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
          const word = doc.getText(wordRange);

          const tag = (lineText.match(/(?<=<\/?)[\w|\-]+\b/) || [])[0];
          if (!tag || tag !== word || wxTags.includes(tag)) {
            return;
          }
          return handleComponentJump(doc.fileName, tag);
        },
      },
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      [{ scheme: 'file', language: 'scss', pattern: '**/*.scss' }],
      {
        provideDefinition(
          doc: vscode.TextDocument,
          position: vscode.Position,
          token: vscode.CancellationToken,
        ) {
          // 检查是否按下了 Option/Alt 键
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.selections.length > 0) {
            const selection = editor.selections[0];
            if (selection.isEmpty && vscode.window.activeTextEditor?.document === doc) {
              const lineText = doc.lineAt(position).text;
              const importMatch = lineText.match(/@import\s+(['"])(.+?)\1/);
              if (importMatch) {
                const importPath = importMatch[2];
                return handleAliasJump(doc.fileName, importPath, doc.languageId);
              }
            }
          }
          return null;
        },
      },
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('miniCustomComponentJump.createComponent', async (uri: vscode.Uri) => {
      const folderPath = uri.fsPath;
      const componentName = await vscode.window.showInputBox({ prompt: '请输入组件名称' });
      
      if (componentName) {
        const config = getConfig();
        const useComponentNameAsFileName = config.get('useComponentNameAsFileName') as boolean;
        
        const fileName = useComponentNameAsFileName ? componentName : 'index';
        const files = ['json', 'ts', 'scss', 'wxml'];
        
        if (useComponentNameAsFileName) {
          for (const ext of files) {
            const filePath = path.join(folderPath, `${fileName}.${ext}`);
            fs.writeFileSync(filePath, '');
          }
        } else {
          const componentFolder = path.join(folderPath, componentName);
          fs.mkdirSync(componentFolder, { recursive: true });
          for (const ext of files) {
            const filePath = path.join(componentFolder, `${fileName}.${ext}`);
            fs.writeFileSync(filePath, '');
          }
        }
        
        vscode.window.showInformationMessage(`组件 ${componentName} 创建成功！`);
      }
    })
  );
}

function handleComponentJump(filePath: string, tag: string) {
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
    const config = getConfig();
    let fileTypes = config.get('aliasJumpFileTypes') as string[];
    if (!fileTypes || fileTypes.length === 0) {
      fileTypes = [path.extname(filePath).slice(1)];
    }

    const componentPath = tryOpenFile(path.join(rootPath, compPath), fileTypes);
    
    if (componentPath) {
      return new vscode.Location(
        vscode.Uri.file(componentPath),
        new vscode.Position(0, 0),
      );
    }
  }
}

function handleAliasJump(filePath: string, importPath: string, sourceFileType: string) {
  if (!rootPath) {
    rootPath = findRootPath(filePath);
  }

  const aliasMap = loadAliasMap();
  const resolvedPath = resolveAliasPath(importPath, aliasMap);

  if (!resolvedPath) {
    return null;
  }

  // 对于 SCSS 文件，直接使用解析后的路径
  if (sourceFileType === 'scss') {
    const fullPath = path.join(rootPath, resolvedPath);

    if (fs.existsSync(fullPath)) {
      return new vscode.Location(
        vscode.Uri.file(fullPath),
        new vscode.Position(0, 0),
      );
    }
    return null;
  }

  // 对于其他文件类型，保持原有的逻辑
  const config = getConfig();
  let fileTypes = config.get('aliasJumpFileTypes') as string[];
  
  const sourceExtension = path.extname(filePath).slice(1);
  fileTypes = [sourceExtension, ...fileTypes.filter(type => type !== sourceExtension)];

  const uniqueFileTypes = Array.from(new Set(fileTypes));

  const componentPath = tryOpenFile(path.join(rootPath, resolvedPath), uniqueFileTypes);

  if (componentPath) {
    return new vscode.Location(
      vscode.Uri.file(componentPath),
      new vscode.Position(0, 0),
    );
  }

  return null;
}
