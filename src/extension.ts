import * as vscode from 'vscode';
import { createWxmlDefinitionProvider, createScssDefinitionProvider } from './providers/definitionProvider';
import { createScssHoverProvider } from './providers/hoverProvider';
import { createConvertToScssVariableCommand } from './commands/convertToScssVariable';
import { createCreateComponentCommand } from './commands/createComponent';

export function activate(context: vscode.ExtensionContext) {
  // 注册定义跳转提供者
  context.subscriptions.push(createWxmlDefinitionProvider());
  context.subscriptions.push(createScssDefinitionProvider());
  
  // 注册悬停提示提供者
  context.subscriptions.push(createScssHoverProvider());
  
  // 注册命令
  context.subscriptions.push(createConvertToScssVariableCommand());
  context.subscriptions.push(createCreateComponentCommand());
}
