import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { findRootPath, loadAliasMap, getConfig } from './config';

/**
 * 解析别名路径
 * @param aliasPath 别名路径
 * @param aliasMap 别名映射
 * @returns 解析后的路径，如果无法解析则返回null
 */
export function resolveAliasPath(aliasPath: string, aliasMap: Record<string, string>): string | null {
  for (const alias in aliasMap) {
    if (aliasPath.startsWith(alias)) {
      return aliasPath.replace(alias, aliasMap[alias]);
    }
  }
  return null;
}

/**
 * 尝试打开文件
 * @param basePath 基础路径
 * @param fileTypes 文件类型数组
 * @returns 找到的文件路径，如果未找到则返回null
 */
export function tryOpenFile(basePath: string, fileTypes: string[]): string | null {
  for (const type of fileTypes) {
    const filePath = `${basePath}.${type}`;
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * 处理组件跳转
 * @param filePath 当前文件路径
 * @param tag 组件标签
 * @returns vscode.Location对象，表示跳转位置
 */
export function handleComponentJump(filePath: string, tag: string) {
  let jsonFile = filePath.replace('.wxml', '.json');
  const rootPath = findRootPath(filePath);
  const aliasMap = loadAliasMap(rootPath);
  
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
    let fileType = config.get('defaultOpenFileType') as string;
    let fileTypes: string[] = [];
    if (!fileType) {
      fileTypes = [path.extname(filePath).slice(1)];
    } else {
      fileTypes = [fileType];
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

/**
 * 处理别名跳转
 * @param filePath 当前文件路径
 * @param importPath 导入路径
 * @param sourceFileType 源文件类型
 * @returns vscode.Location对象，表示跳转位置
 */
export function handleAliasJump(filePath: string, importPath: string, sourceFileType: string) {
  const rootPath = findRootPath(filePath);
  const aliasMap = loadAliasMap(rootPath);
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

// 微信小程序内置组件列表
export const wxTags = [
  'movable-view', 'cover-image', 'cover-view', 'movable-area', 'scroll-view',
  'swiper', 'swiper-item', 'view', 'icon', 'progress', 'rich-text', 'text',
  'button', 'checkbox', 'checkbox-group', 'editor', 'form', 'input', 'label',
  'picker', 'picker-view', 'picker-view-column', 'radio', 'radio-group', 'slider',
  'switch', 'textarea', 'functional-page-navigator', 'navigator', 'audio', 'camera',
  'image', 'live-player', 'live-pusher', 'video', 'map', 'canvas', 'ad',
  'official-account', 'open-data', 'web-view',
];
