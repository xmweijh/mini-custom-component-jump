import * as vscode from 'vscode';
import * as fs from 'fs';
import { findRootPath, getDesignTokenPath } from '../utils/config';
import { parseScssVariables, evaluateScssValue } from '../scss/variables';

export function createScssHoverProvider() {
  return vscode.languages.registerHoverProvider(
    [{ scheme: 'file', language: 'scss', pattern: '**/*.scss' }],
    {
      provideHover(document: vscode.TextDocument, position: vscode.Position) {
        const wordRange = document.getWordRangeAtPosition(position, /\$[\w-]+/);
        if (!wordRange) {
          return;
        }
        
        const word = document.getText(wordRange);
        console.log('Hovering over variable:', word);
        
        // 先从design-token文件中查找变量定义
        const rootPath = findRootPath(document.fileName);
        const designTokenPath = getDesignTokenPath(rootPath);
        
        if (fs.existsSync(designTokenPath)) {
          console.log('Reading design token file:', designTokenPath);
          const content = fs.readFileSync(designTokenPath, 'utf-8');
          const variables = parseScssVariables(content);
          console.log('Found variables in design token:', variables);
          
          const variable = variables.find(v => `$${v.name}` === word);
          if (variable) {
            const evaluatedValue = evaluateScssValue(variable.value, variables);
            const markdown = new vscode.MarkdownString();
            markdown.appendCodeblock(`${word}: ${variable.value}`, 'scss');
            if (evaluatedValue !== variable.value) {
              markdown.appendCodeblock(`Computed value: ${evaluatedValue}`, 'scss');
            }
            if (variable.description) {
              markdown.appendMarkdown(`\n\n${variable.description}`);
            }
            return new vscode.Hover(markdown);
          }
        }
        
        // 如果在design-token中没找到，再从当前文件查找
        const currentContent = document.getText();
        const currentVariables = parseScssVariables(currentContent);
        const currentVariable = currentVariables.find(v => `$${v.name}` === word);
        if (currentVariable) {
          const evaluatedValue = evaluateScssValue(currentVariable.value, currentVariables);
          const markdown = new vscode.MarkdownString();
          markdown.appendCodeblock(`${word}: ${currentVariable.value}`, 'scss');
          if (evaluatedValue !== currentVariable.value) {
            markdown.appendCodeblock(`Computed value: ${evaluatedValue}`, 'scss');
          }
          if (currentVariable.description) {
            markdown.appendMarkdown(`\n\n${currentVariable.description}`);
          }
          return new vscode.Hover(markdown);
        }
      }
    }
  );
} 