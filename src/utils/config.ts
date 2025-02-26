import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function getConfig() {
  return vscode.workspace.getConfiguration('miniCustomComponentJump');
}

export function getDesignTokenPath(rootPath: string): string {
  const config = getConfig();
  const designTokenPath = config.get('designTokenPath') as string;
  return path.join(rootPath, designTokenPath);
}

export function findRootPath(filePath: string): string {
  const dir = path.dirname(filePath);
  const files = fs.readdirSync(dir);

  if (files.includes('tsconfig.json') || files.includes('jsconfig.json')) {
    return dir;
  } else {
    return findRootPath(dir);
  }
}

export function loadAliasMap(rootPath: string): Record<string, string> {
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