import * as vscode from 'vscode';
import * as fs from 'fs';
import { findRootPath, getDesignTokenPath } from '../utils/config';
import { parseScssVariables, findMatchingVariable } from '../scss/variables';

export function createConvertToScssVariableCommand() {
  return vscode.commands.registerCommand('miniCustomComponentJump.convertToScssVariable', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'scss') {
      return;
    }

    // 获取所有design token变量
    const rootPath = findRootPath(editor.document.fileName);
    const designTokenPath = getDesignTokenPath(rootPath);
    if (!fs.existsSync(designTokenPath)) {
      vscode.window.showErrorMessage('Design token file not found');
      return;
    }

    const content = fs.readFileSync(designTokenPath, 'utf-8');
    const variables = parseScssVariables(content);
    console.log('Loaded variables:', variables);

    // 获取选中的文本范围，如果没有选中则使用当前行
    const selection = editor.selection;
    const startLine = selection.start.line;
    const endLine = selection.end.line;
    let edits: vscode.TextEdit[] = [];

    // 处理选中范围内的每一行
    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
      const line = editor.document.lineAt(lineNum);
      const lineText = line.text;

      // 匹配CSS属性和值
      const propertyValueRegex = /([a-zA-Z-]+)\s*:\s*([^;]+);/g;
      let match;

      while ((match = propertyValueRegex.exec(lineText)) !== null) {
        const [fullMatch, property, valueStr] = match;
        console.log('Processing property:', { property, valueStr });
        
        // 分割多个值（处理如 margin: 24rpx 16rpx 的情况）
        const values = valueStr.trim().split(/\s+/);
        const newValues = values.map(value => {
          const matchingVariable = findMatchingVariable(value.trim(), property.trim(), variables);
          return matchingVariable ? `$${matchingVariable.name}` : value;
        });

        // 只有当有值被替换时才创建编辑
        if (newValues.some((v, i) => v !== values[i])) {
          const range = new vscode.Range(
            lineNum,
            match.index + property.length + 1, // +1 for the colon
            lineNum,
            match.index + fullMatch.length - 1 // -1 for the semicolon
          );
          edits.push(vscode.TextEdit.replace(range, ` ${newValues.join(' ')}`));
        }
      }
    }

    if (edits.length > 0) {
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.set(editor.document.uri, edits);
      await vscode.workspace.applyEdit(workspaceEdit);
    }
  });
} 