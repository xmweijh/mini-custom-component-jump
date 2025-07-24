import * as vscode from 'vscode';
import * as fs from 'fs';
import {
  parseMvObserveConfigs,
  checkSelectorInWxml,
  getCorrespondingWxmlPath,
  getCorrespondingTsPath,
  extractClassesAndIds
} from '../utils/trackingUtils';

/**
 * 创建埋点悬停提示提供者 - TypeScript/JavaScript
 */
export function createTrackingTsHoverProvider() {
  return vscode.languages.registerHoverProvider(
    [
      { scheme: 'file', language: 'typescript', pattern: '**/*.ts' },
      { scheme: 'file', language: 'javascript', pattern: '**/*.js' }
    ],
    {
      provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const content = document.getText();
        const configs = parseMvObserveConfigs(content);

        if (configs.length === 0) {
          return undefined;
        }

        // 检查鼠标位置是否在mvObserve调用上
        const line = document.lineAt(position).text;
        const wordRange = document.getWordRangeAtPosition(position, /lxCore\.mvObserve/);

        if (!wordRange) {
          return undefined;
        }

        // 找到当前行对应的配置
        const currentLineConfig = configs.find(config => config.line === position.line);
        if (!currentLineConfig) {
          return undefined;
        }

        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        // 标题
        markdown.appendMarkdown('## 📊 埋点配置检查\n\n');

         // 显示配置信息
         markdown.appendCodeblock(`observeDom: "${currentLineConfig.observeDom}"`, 'typescript');

         // 检查lx-前缀规则
         let selectorName = '';
         if (currentLineConfig.observeDom.startsWith('.')) {
           selectorName = currentLineConfig.observeDom.substring(1);
         } else if (currentLineConfig.observeDom.startsWith('#')) {
           selectorName = currentLineConfig.observeDom.substring(1);
         }

         if (selectorName && !selectorName.startsWith('lx-')) {
           markdown.appendMarkdown('\n\n⚠️ **命名规范提醒:** 选择器应该以 `lx-` 开头\n');
           markdown.appendMarkdown(`💡 **建议使用:** \`${currentLineConfig.observeDom.charAt(0)}lx-${selectorName}\`\n`);
         } else if (selectorName && selectorName.startsWith('lx-')) {
           markdown.appendMarkdown('\n\n✅ **命名规范:** 选择器命名符合 `lx-` 前缀规范\n');
         }

         if (currentLineConfig.getBid) {
           markdown.appendMarkdown('\n**getBid 函数:**\n');
           markdown.appendCodeblock(currentLineConfig.getBid, 'typescript');
         }

         if (currentLineConfig.useParams) {
           markdown.appendMarkdown('\n**useParams 参数:**\n');
           markdown.appendCodeblock(`{ ${currentLineConfig.useParams} }`, 'typescript');
         }

        // 检查对应的WXML文件
        const wxmlPath = getCorrespondingWxmlPath(document.fileName);
        if (!wxmlPath) {
          markdown.appendMarkdown('\n\n⚠️ **警告:** 找不到对应的WXML文件\n');
          return new vscode.Hover(markdown);
        }

        // 检查选择器是否存在
        const wxmlContent = fs.readFileSync(wxmlPath, 'utf-8');
        const selectorExists = checkSelectorInWxml(wxmlContent, currentLineConfig.observeDom);

        if (selectorExists) {
          markdown.appendMarkdown('\n\n✅ **状态:** 选择器在WXML中找到匹配元素\n');
        } else {
          markdown.appendMarkdown('\n\n❌ **错误:** 选择器在WXML中未找到匹配元素\n');

          // 提供可能的修复建议
          const { classes, ids } = extractClassesAndIds(wxmlContent);

          if (currentLineConfig.observeDom.startsWith('.')) {
            const targetClass = currentLineConfig.observeDom.substring(1);
            const similarClasses = classes.filter(cls =>
              cls.toLowerCase().includes(targetClass.toLowerCase()) ||
              targetClass.toLowerCase().includes(cls.toLowerCase())
            );

            if (similarClasses.length > 0) {
              markdown.appendMarkdown('\n**可能的修复建议:**\n');
              similarClasses.forEach(cls => {
                markdown.appendMarkdown(`- 使用 \`.${cls}\`\n`);
              });
            }
          } else if (currentLineConfig.observeDom.startsWith('#')) {
            const targetId = currentLineConfig.observeDom.substring(1);
            const similarIds = ids.filter(id =>
              id.toLowerCase().includes(targetId.toLowerCase()) ||
              targetId.toLowerCase().includes(id.toLowerCase())
            );

            if (similarIds.length > 0) {
              markdown.appendMarkdown('\n**可能的修复建议:**\n');
              similarIds.forEach(id => {
                markdown.appendMarkdown(`- 使用 \`#${id}\`\n`);
              });
            }
          }
        }

        // 显示WXML文件路径
        markdown.appendMarkdown(`\n\n📄 **对应WXML文件:** \`${wxmlPath.split('/').pop()}\`\n`);

        return new vscode.Hover(markdown);
      }
    }
  );
}

/**
 * 创建埋点悬停提示提供者 - WXML
 */
export function createTrackingWxmlHoverProvider() {
  return vscode.languages.registerHoverProvider(
    [{ scheme: 'file', language: 'wxml', pattern: '**/*.wxml' }],
    {
      provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const line = document.lineAt(position).text;

        // 检查是否在class或id属性上
        let classMatch = line.match(/class\s*=\s*["']([^"']+)["']/);
        let idMatch = line.match(/id\s*=\s*["']([^"']+)["']/);

        let isOnClass = false;
        let isOnId = false;
        let hoveredValue = '';

        // 检查鼠标位置是否在class属性值上
        if (classMatch) {
          const classIndex = line.indexOf(classMatch[0]);
          const classValueStart = line.indexOf(classMatch[1], classIndex);
          const classValueEnd = classValueStart + classMatch[1].length;

          if (position.character >= classValueStart && position.character <= classValueEnd) {
            isOnClass = true;
            // 确定具体悬停在哪个class上
            const classes = classMatch[1].split(/\s+/);
            let currentPos = classValueStart;
            for (const cls of classes) {
              if (position.character >= currentPos && position.character <= currentPos + cls.length) {
                hoveredValue = cls;
                break;
              }
              currentPos += cls.length + 1; // +1 for space
            }
          }
        }

        // 检查鼠标位置是否在id属性值上
        if (idMatch && !isOnClass) {
          const idIndex = line.indexOf(idMatch[0]);
          const idValueStart = line.indexOf(idMatch[1], idIndex);
          const idValueEnd = idValueStart + idMatch[1].length;

          if (position.character >= idValueStart && position.character <= idValueEnd) {
            isOnId = true;
            hoveredValue = idMatch[1];
          }
        }

        if (!isOnClass && !isOnId) {
          return undefined;
        }

        // 获取对应的TypeScript文件
        const tsPath = getCorrespondingTsPath(document.fileName);
        if (!tsPath) {
          return undefined;
        }

        // 读取TypeScript文件内容
        const tsContent = fs.readFileSync(tsPath, 'utf-8');
        const configs = parseMvObserveConfigs(tsContent);

        if (configs.length === 0) {
          return undefined;
        }

        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        // 检查当前class/id是否被埋点配置使用
        const selector = isOnClass ? `.${hoveredValue}` : `#${hoveredValue}`;
        const relatedConfigs = configs.filter(config => config.observeDom === selector);

        if (relatedConfigs.length > 0) {
          markdown.appendMarkdown('## 📊 埋点关联信息\n\n');
          markdown.appendMarkdown(`✅ **此${isOnClass ? 'class' : 'id'}被以下埋点配置使用:**\n\n`);

          relatedConfigs.forEach((config, index) => {
            markdown.appendMarkdown(`### 配置 ${index + 1}\n`);
            markdown.appendCodeblock(`observeDom: "${config.observeDom}"`, 'typescript');

            if (config.getBid) {
              markdown.appendMarkdown('**getBid:**\n');
              markdown.appendCodeblock(config.getBid, 'typescript');
            }

            if (config.useParams) {
              markdown.appendMarkdown('**useParams:**\n');
              markdown.appendCodeblock(`{ ${config.useParams} }`, 'typescript');
            }

            markdown.appendMarkdown(`**位置:** 第 ${config.line + 1} 行\n\n`);
          });

          markdown.appendMarkdown('⚠️ **注意:** 修改此属性值可能会导致埋点失效\n');
        } else {
          // 检查是否有相似的选择器
          const similarConfigs = configs.filter(config => {
            if (isOnClass && config.observeDom.startsWith('.')) {
              const configClass = config.observeDom.substring(1);
              return configClass.toLowerCase().includes(hoveredValue.toLowerCase()) ||
                     hoveredValue.toLowerCase().includes(configClass.toLowerCase());
            } else if (isOnId && config.observeDom.startsWith('#')) {
              const configId = config.observeDom.substring(1);
              return configId.toLowerCase().includes(hoveredValue.toLowerCase()) ||
                     hoveredValue.toLowerCase().includes(configId.toLowerCase());
            }
            return false;
          });

          if (similarConfigs.length > 0) {
            markdown.appendMarkdown('## 📊 埋点关联信息\n\n');
            markdown.appendMarkdown(`💡 **发现相似的埋点配置:**\n\n`);

            similarConfigs.forEach((config, index) => {
              markdown.appendMarkdown(`### 相似配置 ${index + 1}\n`);
              markdown.appendCodeblock(`observeDom: "${config.observeDom}"`, 'typescript');
              markdown.appendMarkdown(`**位置:** 第 ${config.line + 1} 行\n\n`);
            });

            markdown.appendMarkdown('💡 **提示:** 检查是否需要使用此选择器或更新配置\n');
          }
        }

        if (markdown.value.length > 0) {
          markdown.appendMarkdown(`\n📄 **对应TS文件:** \`${tsPath.split('/').pop()}\`\n`);
          return new vscode.Hover(markdown);
        }

        return undefined;
      }
    }
  );
}
