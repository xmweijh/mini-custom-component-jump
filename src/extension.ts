import * as vscode from 'vscode';
import { createWxmlDefinitionProvider, createScssDefinitionProvider } from './providers/definitionProvider';
import { createScssHoverProvider } from './providers/hoverProvider';
import { createConvertToScssVariableCommand } from './commands/convertToScssVariable';
import { createCreateComponentCommand } from './commands/createComponent';
import { createTrackingDiagnosticProvider } from './providers/trackingDiagnosticProvider';
import { createTrackingTsHoverProvider, createTrackingWxmlHoverProvider } from './providers/trackingHoverProvider';

export function activate(context: vscode.ExtensionContext) {
  // 注册定义跳转提供者
  context.subscriptions.push(createWxmlDefinitionProvider());
  context.subscriptions.push(createScssDefinitionProvider());
  
  // 注册悬停提示提供者
  context.subscriptions.push(createScssHoverProvider());
  
  // 注册埋点检测功能
  context.subscriptions.push(createTrackingDiagnosticProvider());
  context.subscriptions.push(createTrackingTsHoverProvider());
  context.subscriptions.push(createTrackingWxmlHoverProvider());

  // 注册命令
  context.subscriptions.push(createConvertToScssVariableCommand());
  context.subscriptions.push(createCreateComponentCommand());
}
