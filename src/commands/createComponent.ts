import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../utils/config';

export function createCreateComponentCommand() {
  return vscode.commands.registerCommand('miniCustomComponentJump.createComponent', async (uri: vscode.Uri) => {
    const folderPath = uri.fsPath;
    
    // 获取组件名
    const componentName = await vscode.window.showInputBox({
      prompt: "输入组件名",
      placeHolder: "例如: my-component"
    });

    if (!componentName) {
      return; // 用户取消了输入
    }

    const config = getConfig();
    const useComponentNameAsFileName = config.get('useComponentNameAsFileName') as boolean;
    const fileName = useComponentNameAsFileName ? componentName : 'index';

    // 创建组件文件夹
    const componentFolder = path.join(folderPath, componentName);
    fs.mkdirSync(componentFolder, { recursive: true });

    // 创建组件文件
    const files = [
      { name: `${fileName}.ts`, content: `Component({})` },
      { name: `${fileName}.wxml`, content: `<view class="${componentName}"></view>` },
      { name: `${fileName}.scss`, content: `.${componentName} {}` },
      { name: `${fileName}.json`, content: `{\n  "component": true\n}` }
    ];

    files.forEach(file => {
      fs.writeFileSync(path.join(componentFolder, file.name), file.content);
    });

    vscode.window.showInformationMessage(`组件 ${componentName} 创建成功！`);
  });
}
