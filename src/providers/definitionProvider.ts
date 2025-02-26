import * as vscode from 'vscode';
import * as fs from 'fs';
import { findRootPath, getDesignTokenPath } from '../utils/config';
import { parseScssVariables } from '../scss/variables';
import { handleComponentJump, wxTags, handleAliasJump } from '../utils/fileUtils';
import * as path from 'path';

export function createWxmlDefinitionProvider() {
  return vscode.languages.registerDefinitionProvider(
    [{ scheme: 'file', language: 'wxml', pattern: '**/*.wxml' }],
    {
      provideDefinition(
        doc: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
      ) {
        const lineText = doc.lineAt(position).text;
        const wordRange = doc.getWordRangeAtPosition(position, /[\w|\-]+\b/);
        if (!wordRange) {
          return;
        }
        
        const word = doc.getText(wordRange);

        const tag = (lineText.match(/(?<=<\/?)[\w|\-]+\b/) || [])[0];
        if (!tag || tag !== word || wxTags.includes(tag)) {
          return;
        }
        return handleComponentJump(doc.fileName, tag);
      },
    },
  );
}

export function createScssDefinitionProvider() {
  return vscode.languages.registerDefinitionProvider(
    [{ scheme: 'file', language: 'scss', pattern: '**/*.scss' }],
    {
      provideDefinition(
        doc: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
      ) {
        const lineText = doc.lineAt(position).text;
        
        // 检查是否是import关键字
        const importWordRange = doc.getWordRangeAtPosition(position, /@import\b/);
        if (importWordRange) {
          // 获取import语句中的路径
          const importMatch = lineText.match(/@import\s+['"]([^'"]+)['"]/);
          if (importMatch) {
            const importPath = importMatch[1];
            
            // 处理相对路径
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
              const dirName = path.dirname(doc.fileName);
              let fullPath = path.resolve(dirName, importPath);
              
              // 如果没有扩展名，添加.scss扩展名
              if (!path.extname(fullPath)) {
                fullPath += '.scss';
              }
              
              if (fs.existsSync(fullPath)) {
                return new vscode.Location(
                  vscode.Uri.file(fullPath),
                  new vscode.Position(0, 0)
                );
              }
            } else {
              // 处理别名路径
              return handleAliasJump(doc.fileName, importPath, 'scss');
            }
          }
        }
        
        // 处理SCSS变量跳转（原有功能）
        const wordRange = doc.getWordRangeAtPosition(position, /\$[\w-]+/);
        if (!wordRange) {
          return;
        }
        
        const word = doc.getText(wordRange);
        
        // 直接从design-token文件中查找
        const rootPath = findRootPath(doc.fileName);
        const designTokenPath = getDesignTokenPath(rootPath);
        
        if (fs.existsSync(designTokenPath)) {
          const content = fs.readFileSync(designTokenPath, 'utf-8');
          const variables = parseScssVariables(content);
          const variable = variables.find(v => `$${v.name}` === word);
          if (variable) {
            return new vscode.Location(
              vscode.Uri.file(designTokenPath),
              new vscode.Position(variable.line, 0)
            );
          }
        }
        
        // 如果在design-token中没找到，再从当前文件查找
        const currentContent = doc.getText();
        const currentVariables = parseScssVariables(currentContent);
        const currentVariable = currentVariables.find(v => `$${v.name}` === word);
        if (currentVariable) {
          return new vscode.Location(
            doc.uri,
            new vscode.Position(currentVariable.line, 0)
          );
        }
      }
    }
  );
}
