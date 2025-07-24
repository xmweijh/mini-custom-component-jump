import * as vscode from 'vscode';
import * as fs from 'fs';
import {
  parseMvObserveConfigs,
  checkSelectorInWxml,
  getCorrespondingWxmlPath,
  getCorrespondingTsPath,
  extractClassesAndIds,
  TrackingObserveConfig
} from '../utils/trackingUtils';

/**
 * 埋点诊断提供者
 */
export class TrackingDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];
  private fileContentCache = new Map<string, { content: string; mtime: number }>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('tracking');

    // 监听文件变化
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this),
      vscode.workspace.onDidOpenTextDocument(this.onDidOpenTextDocument, this),
      vscode.workspace.onDidCloseTextDocument(this.onDidCloseTextDocument, this)
    );

    // 初始检查所有已打开的文档
    vscode.workspace.textDocuments.forEach(doc => this.updateDiagnostics(doc));
  }

  private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
    this.debouncedUpdateDiagnostics(event.document);
  }

  private onDidOpenTextDocument(document: vscode.TextDocument) {
    this.updateDiagnostics(document);
  }

  private onDidCloseTextDocument(document: vscode.TextDocument) {
    // 清理缓存
    this.fileContentCache.delete(document.fileName);
    const timer = this.debounceTimers.get(document.fileName);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(document.fileName);
    }
  }

  private debouncedUpdateDiagnostics(document: vscode.TextDocument) {
    const key = document.fileName;
    const existingTimer = this.debounceTimers.get(key);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.updateDiagnostics(document);
      this.debounceTimers.delete(key);
    }, 300); // 300ms防抖

    this.debounceTimers.set(key, timer);
  }

  private updateDiagnostics(document: vscode.TextDocument) {
    if (document.languageId === 'typescript' || document.languageId === 'javascript') {
      this.checkTypeScriptFile(document);
    } else if (document.languageId === 'wxml') {
      this.checkWxmlFile(document);
    }
  }

  /**
   * 缓存文件内容读取
   */
  private getCachedFileContent(filePath: string): string | null {
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtime.getTime();
      const cached = this.fileContentCache.get(filePath);

      if (cached && cached.mtime === mtime) {
        return cached.content;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      this.fileContentCache.set(filePath, { content, mtime });
      return content;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查TypeScript文件中的埋点配置
   */
  private checkTypeScriptFile(document: vscode.TextDocument) {
    const diagnostics: vscode.Diagnostic[] = [];
    const content = document.getText();

    // 解析mvObserve配置
    const configs = parseMvObserveConfigs(content);

    if (configs.length === 0) {
      this.diagnosticCollection.set(document.uri, diagnostics);
      return;
    }

    // 获取对应的WXML文件
    const wxmlPath = getCorrespondingWxmlPath(document.fileName);
    if (!wxmlPath) {
      // 如果没有对应的WXML文件，标记所有的mvObserve配置为警告
      configs.forEach(config => {
        const range = new vscode.Range(
          new vscode.Position(config.line, config.character),
          new vscode.Position(config.line, config.character + 'lxCore.mvObserve'.length)
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          `找不到对应的WXML文件，无法验证选择器 '${config.observeDom}'`,
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = '埋点检测';
        diagnostics.push(diagnostic);
      });

      this.diagnosticCollection.set(document.uri, diagnostics);
      return;
    }

    // 使用缓存读取WXML文件内容
    const wxmlContent = this.getCachedFileContent(wxmlPath);
    if (!wxmlContent) {
      // 文件读取失败，标记所有配置为警告
      configs.forEach(config => {
        const range = new vscode.Range(
          new vscode.Position(config.line, config.character),
          new vscode.Position(config.line, config.character + 'lxCore.mvObserve'.length)
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          `无法读取对应的WXML文件: ${wxmlPath}`,
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = '埋点检测';
        diagnostics.push(diagnostic);
      });

      this.diagnosticCollection.set(document.uri, diagnostics);
      return;
    }

    // 检查每个配置
    configs.forEach(config => {
      const range = new vscode.Range(
        new vscode.Position(config.line, config.character),
        new vscode.Position(config.line, config.character + 'lxCore.mvObserve'.length)
      );

      // 检查observeDom是否为空字符串
      if (!config.observeDom || config.observeDom.trim() === '') {
        const diagnostic = new vscode.Diagnostic(
          range,
          `埋点配置的observeDom不能为空，请指定有效的CSS选择器`,
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = '埋点检测';
        diagnostic.code = 'empty-selector';
        diagnostics.push(diagnostic);
        return; // 空选择器不需要进行后续检查
      }

      // 检查选择器格式是否有效
      if (!config.observeDom.startsWith('.') && !config.observeDom.startsWith('#')) {
        const diagnostic = new vscode.Diagnostic(
          range,
          `埋点选择器 '${config.observeDom}' 格式无效，应该以'.'（class）或'#'（id）开头`,
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = '埋点检测';
        diagnostic.code = 'invalid-selector-format';
        diagnostics.push(diagnostic);
        return; // 格式无效不需要进行后续检查
      }

      // 检查选择器是否以lx-开头
      let selectorName = '';
      if (config.observeDom.startsWith('.')) {
        // class选择器
        selectorName = config.observeDom.substring(1);
      } else if (config.observeDom.startsWith('#')) {
        // id选择器
        selectorName = config.observeDom.substring(1);
      }

      if (selectorName && !selectorName.startsWith('lx-')) {
        const diagnostic = new vscode.Diagnostic(
          range,
          `埋点选择器 '${config.observeDom}' 应该以 'lx-' 开头，建议使用 '${config.observeDom.charAt(0)}lx-${selectorName}'`,
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = '埋点检测';
        diagnostic.code = 'lx-prefix-required';
        diagnostics.push(diagnostic);
      }

      // 检查选择器名称是否为空（例如只有'.'或'#'）
      if (!selectorName) {
        const diagnostic = new vscode.Diagnostic(
          range,
          `埋点选择器 '${config.observeDom}' 缺少选择器名称，例如应该是'.lx-button'而不是'.'`,
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = '埋点检测';
        diagnostic.code = 'empty-selector-name';
        diagnostics.push(diagnostic);
        return; // 选择器名称为空不需要检查WXML
      }

      // 检查选择器在WXML中是否存在
      const selectorExists = checkSelectorInWxml(wxmlContent, config.observeDom);

      if (!selectorExists) {
        const diagnostic = new vscode.Diagnostic(
          range,
          `埋点配置中的选择器 '${config.observeDom}' 在对应的WXML文件中未找到匹配元素`,
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = '埋点检测';
        diagnostic.code = 'missing-selector';
        diagnostics.push(diagnostic);
      }
    });

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /**
   * 检查WXML文件，警告可能影响埋点的class/id变化
   */
  private checkWxmlFile(document: vscode.TextDocument) {
    const diagnostics: vscode.Diagnostic[] = [];
    const content = document.getText();

    // 获取对应的TypeScript文件
    const tsPath = getCorrespondingTsPath(document.fileName);
    if (!tsPath) {
      this.diagnosticCollection.set(document.uri, diagnostics);
      return;
    }

    // 使用缓存读取TypeScript文件内容
    const tsContent = this.getCachedFileContent(tsPath);
    if (!tsContent) {
      this.diagnosticCollection.set(document.uri, diagnostics);
      return;
    }

    const configs = parseMvObserveConfigs(tsContent);

    if (configs.length === 0) {
      this.diagnosticCollection.set(document.uri, diagnostics);
      return;
    }

    // 提取WXML中的所有class和id
    const { classes, ids } = extractClassesAndIds(content);

    // 检查TS中配置的选择器是否在WXML中存在
    const tsSelectors = configs.map(config => config.observeDom);

    // 为每个在TS中配置但在WXML中不存在的选择器创建诊断
    configs.forEach(config => {
      const selectorExists = checkSelectorInWxml(content, config.observeDom);
      if (!selectorExists) {
        // 在WXML中找到可能的相关元素位置来标记
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('class=') || line.includes('id=')) {
            const range = new vscode.Range(
              new vscode.Position(i, 0),
              new vscode.Position(i, line.length)
            );

            const diagnostic = new vscode.Diagnostic(
              range,
              `注意：TypeScript文件中配置的埋点选择器 '${config.observeDom}' 在此WXML文件中未找到`,
              vscode.DiagnosticSeverity.Information
            );
            diagnostic.source = '埋点检测';
            diagnostic.code = 'selector-not-found';
            diagnostics.push(diagnostic);
            break; // 只标记一次即可
          }
        }
      }
    });

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  dispose() {
    this.diagnosticCollection.dispose();
    this.disposables.forEach(d => d.dispose());

    // 清理所有缓存
    this.fileContentCache.clear();

    // 清理所有定时器
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }
}

/**
 * 创建埋点诊断提供者
 */
export function createTrackingDiagnosticProvider(): vscode.Disposable {
  const provider = new TrackingDiagnosticProvider();
  return provider;
}
